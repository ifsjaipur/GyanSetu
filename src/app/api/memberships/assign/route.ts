import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { writeAuditLog } from "@/lib/audit-log";

/**
 * POST /api/memberships/assign
 * Assign a user to an institution (creates an approved membership).
 * Only super_admin or institution_admin can use this.
 * Body: { userId: string, institutionId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("__session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);

    // Read caller's role from Firestore (not stale token claims)
    const callerDoc = await getAdminDb().collection("users").doc(decoded.uid).get();
    const callerRole = callerDoc.data()?.role || "student";

    if (callerRole !== "super_admin" && callerRole !== "institution_admin") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();
    const { userId, institutionId } = body;

    if (!userId || !institutionId) {
      return NextResponse.json(
        { error: "userId and institutionId are required" },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    // Verify target institution exists and is active
    const instDoc = await db.collection("institutions").doc(institutionId).get();
    if (!instDoc.exists || !instDoc.data()?.isActive) {
      return NextResponse.json(
        { error: "Institution not found or inactive" },
        { status: 404 }
      );
    }

    // Verify target user exists
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = userDoc.data()!;

    // Check if membership already exists
    const membershipRef = db
      .collection("users")
      .doc(userId)
      .collection("memberships")
      .doc(institutionId);
    const existingMembership = await membershipRef.get();

    if (existingMembership.exists && existingMembership.data()?.status === "approved") {
      return NextResponse.json(
        { error: "User already has an approved membership in this institution" },
        { status: 409 }
      );
    }

    // Create or update membership
    await membershipRef.set({
      id: institutionId,
      userId,
      institutionId,
      role: userData.role || "student",
      status: "approved",
      isExternal: false,
      joinMethod: "admin_added",
      requestedAt: FieldValue.serverTimestamp(),
      reviewedAt: FieldValue.serverTimestamp(),
      reviewedBy: decoded.uid,
      reviewNote: `Assigned by ${callerRole}`,
      transferredTo: null,
      createdAt: existingMembership.exists
        ? existingMembership.data()?.createdAt || FieldValue.serverTimestamp()
        : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    writeAuditLog({
      institutionId,
      userId: decoded.uid,
      userEmail: decoded.email || "",
      userRole: callerRole,
      action: "membership.assign",
      resource: "membership",
      resourceId: `${userId}/${institutionId}`,
    }, request);

    return NextResponse.json({
      message: "Membership assigned successfully",
      userId,
      institutionId,
    });
  } catch (err) {
    console.error("Assign membership failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
