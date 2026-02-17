import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import { createInstitutionSchema } from "@shared/validators/institution.validator";
import { getCallerContext } from "@/lib/auth/get-caller-context";

/**
 * GET /api/institutions
 * List institutions. Super admin sees all; others see only their own.
 */
export async function GET(request: NextRequest) {
  try {
    const caller = await getCallerContext(request.cookies.get("__session")?.value);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const db = getAdminDb();

    const { searchParams } = request.nextUrl;
    const browse = searchParams.get("browse") === "true";

    let query;
    if (caller.role === "super_admin") {
      query = db.collection("institutions");
    } else if (browse) {
      // Allow any authenticated user to browse active institutions (for joining)
      query = db.collection("institutions").where("isActive", "==", true);
    } else if (caller.institutionId) {
      query = db.collection("institutions").where("__name__", "==", caller.institutionId);
    } else {
      // No institution yet — let them browse
      query = db.collection("institutions").where("isActive", "==", true);
    }

    const snap = await query.get();
    const institutions = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const response = NextResponse.json({ institutions });
    response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
    return response;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/**
 * POST /api/institutions
 * Create a new institution. Super admin only.
 */
export async function POST(request: NextRequest) {
  try {
    const caller = await getCallerContext(request.cookies.get("__session")?.value);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (caller.role !== "super_admin") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createInstitutionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const db = getAdminDb();

    // Check slug uniqueness
    const existing = await db.collection("institutions").doc(data.slug).get();
    if (existing.exists) {
      return NextResponse.json(
        { error: "An institution with this slug already exists" },
        { status: 409 }
      );
    }

    // Generate a unique 8-char invite code
    const inviteCode = randomBytes(4).toString("hex").toUpperCase();

    // Validate parent institution exists if specified
    if (data.parentInstitutionId) {
      const parentDoc = await db.collection("institutions").doc(data.parentInstitutionId).get();
      if (!parentDoc.exists) {
        return NextResponse.json(
          { error: "Parent institution not found" },
          { status: 400 }
        );
      }
    }

    const docData = {
      ...data,
      id: data.slug,
      parentInstitutionId: data.parentInstitutionId || null,
      institutionType: data.institutionType || "child_online",
      inviteCode,
      location: data.location || {
        country: "",
        state: "",
        city: "",
        lat: null,
        lng: null,
        timezone: "Asia/Kolkata",
      },
      googleWorkspace: {
        customerDomain: "",
        adminEmail: "",
        serviceAccountKeyRef: "",
        classroomTeacherEmail: "",
      },
      razorpay: {
        keyId: "",
        keySecretRef: "",
        webhookSecretRef: "",
      },
      settings: {
        ...data.settings,
        certificateTemplateDocId: "",
        certificateFolderId: "",
        videoStorageBucket: "",
        maintenanceMode: false,
      },
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await db.collection("institutions").doc(data.slug).set(docData);

    return NextResponse.json(docData, { status: 201 });
  } catch (err) {
    console.error("Create institution failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
