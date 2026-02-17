import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { updateInstitutionSchema } from "@shared/validators/institution.validator";

/**
 * GET /api/institutions/:id
 * Get institution config. Super admin or institution's own admin.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionCookie = request.cookies.get("__session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, false);

    if (decoded.role !== "super_admin" && decoded.institutionId !== id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getAdminDb();
    const doc = await db.collection("institutions").doc(id).get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Institution not found" }, { status: 404 });
    }

    const response = NextResponse.json({ id: doc.id, ...doc.data() });
    response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
    return response;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/**
 * PUT /api/institutions/:id
 * Update institution config. Super admin or institution admin.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionCookie = request.cookies.get("__session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const isSuperAdmin = decoded.role === "super_admin";
    const isOwnAdmin =
      decoded.role === "institution_admin" && decoded.institutionId === id;

    if (!isSuperAdmin && !isOwnAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateInstitutionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const docRef = db.collection("institutions").doc(id);
    const existing = await docRef.get();

    if (!existing.exists) {
      return NextResponse.json({ error: "Institution not found" }, { status: 404 });
    }

    await docRef.update({
      ...parsed.data,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const updated = await docRef.get();
    return NextResponse.json({ id: updated.id, ...updated.data() });
  } catch (err) {
    console.error("Update institution failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
