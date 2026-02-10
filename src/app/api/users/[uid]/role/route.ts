import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { UserRole, ROLE_HIERARCHY } from "@shared/enums/roles";

/**
 * PUT /api/users/:uid/role
 * Update a user's role. Admin only.
 * Body: { role: UserRole }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
    const sessionCookie = request.cookies.get("__session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const allowedRoles = ["super_admin", "institution_admin"];
    if (!allowedRoles.includes(decoded.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { role } = await request.json();
    if (!Object.values(UserRole).includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Institution admins cannot assign super_admin
    if (decoded.role === "institution_admin" && role === UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: "Cannot assign super_admin" }, { status: 403 });
    }

    const db = getAdminDb();
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userDoc.data()!;

    // Check institution match for non-super admins
    if (decoded.role !== "super_admin" && user.institutionId !== decoded.institutionId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Update custom claims
    const auth = getAdminAuth();
    await auth.setCustomUserClaims(uid, {
      role,
      institutionId: user.institutionId,
    });

    // Update Firestore
    await db.collection("users").doc(uid).update({
      role,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ uid, role });
  } catch (err) {
    console.error("Update role failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
