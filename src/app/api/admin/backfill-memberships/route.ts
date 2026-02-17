import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { getCallerContext } from "@/lib/auth/get-caller-context";

/**
 * POST /api/admin/backfill-memberships
 * Create missing membership docs for users who have institutionId set
 * but no corresponding membership subcollection document.
 * Admin only (super_admin or institution_admin).
 */
export async function POST(request: NextRequest) {
  try {
    const caller = await getCallerContext(request.cookies.get("__session")?.value);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const allowedRoles = ["super_admin", "institution_admin"];
    if (!allowedRoles.includes(caller.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getAdminDb();

    // Resolve institutionId
    let institutionId = caller.institutionId;
    if (caller.role === "super_admin") {
      const body = await request.json().catch(() => ({}));
      if (body.institutionId) {
        institutionId = body.institutionId;
      }
    }

    if (!institutionId) {
      return NextResponse.json(
        { error: "No institution specified" },
        { status: 400 }
      );
    }

    // Query all users in this institution
    const usersSnap = await db
      .collection("users")
      .where("institutionId", "==", institutionId)
      .get();

    let backfilled = 0;

    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      const membershipRef = db
        .collection("users")
        .doc(userDoc.id)
        .collection("memberships")
        .doc(institutionId);

      const membershipDoc = await membershipRef.get();
      if (!membershipDoc.exists) {
        await membershipRef.set({
          id: institutionId,
          userId: userDoc.id,
          institutionId,
          role: userData.role || "student",
          status: "approved",
          isExternal: userData.isExternal ?? false,
          joinMethod: "email_domain",
          requestedAt: FieldValue.serverTimestamp(),
          reviewedAt: FieldValue.serverTimestamp(),
          reviewedBy: caller.uid,
          reviewNote: "Bulk backfill by admin",
          transferredTo: null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        backfilled++;
      }
    }

    return NextResponse.json({
      backfilled,
      total: usersSnap.size,
    });
  } catch (err) {
    console.error("Backfill memberships failed:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
