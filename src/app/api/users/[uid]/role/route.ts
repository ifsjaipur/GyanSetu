import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { UserRole, ROLE_HIERARCHY } from "@shared/enums/roles";
import { writeAuditLog } from "@/lib/audit-log";

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

    // Domain validation: instructor and institution_admin must have org email
    if (role === UserRole.INSTRUCTOR || role === UserRole.INSTITUTION_ADMIN) {
      if (!user.institutionId) {
        return NextResponse.json(
          { error: "User must belong to an institution before being promoted" },
          { status: 400 }
        );
      }
      const emailDomain = (user.email || "").split("@")[1];
      const instDoc = await db.collection("institutions").doc(user.institutionId).get();
      const allowedDomains: string[] = instDoc.exists
        ? instDoc.data()!.allowedEmailDomains || []
        : [];
      if (!allowedDomains.includes(emailDomain)) {
        return NextResponse.json(
          {
            error: `Only users with an organization email (${allowedDomains.join(", ")}) can be assigned this role`,
          },
          { status: 400 }
        );
      }
    }

    // Update custom claims
    const auth = getAdminAuth();
    await auth.setCustomUserClaims(uid, {
      role,
      institutionId: user.institutionId,
    });

    // Update Firestore user doc
    await db.collection("users").doc(uid).update({
      role,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Also update the membership subcollection doc so Admissions page reflects the role
    if (user.institutionId) {
      const membershipRef = db
        .collection("users")
        .doc(uid)
        .collection("memberships")
        .doc(user.institutionId);
      const membershipDoc = await membershipRef.get();
      if (membershipDoc.exists) {
        await membershipRef.update({
          role,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    writeAuditLog({
      institutionId: user.institutionId,
      userId: decoded.uid,
      userEmail: decoded.email || "",
      userRole: decoded.role,
      action: "user.role_change",
      resource: "user",
      resourceId: uid,
      details: { previousRole: user.role, newRole: role, targetEmail: user.email },
      severity: "warning",
    }, request);

    return NextResponse.json({ uid, role });
  } catch (err) {
    console.error("Update role failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
