import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { createInstitutionSchema } from "@shared/validators/institution.validator";

/**
 * GET /api/institutions
 * List institutions. Super admin sees all; others see only their own.
 */
export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("__session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const db = getAdminDb();

    let query;
    if (decoded.role === "super_admin") {
      query = db.collection("institutions");
    } else if (decoded.institutionId) {
      query = db.collection("institutions").where("__name__", "==", decoded.institutionId);
    } else {
      return NextResponse.json({ error: "No institution assigned" }, { status: 403 });
    }

    const snap = await query.get();
    const institutions = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ institutions });
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
    const sessionCookie = request.cookies.get("__session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    if (decoded.role !== "super_admin") {
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

    const docData = {
      ...data,
      id: data.slug,
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
