import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

/**
 * GET /api/payments
 * List payments. Admin only.
 */
export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("__session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const allowedRoles = ["super_admin", "institution_admin"];
    if (!allowedRoles.includes(decoded.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getAdminDb();
    let institutionId =
      decoded.role === "super_admin"
        ? request.nextUrl.searchParams.get("institutionId") || decoded.institutionId
        : decoded.institutionId;

    if (!institutionId) {
      const userDoc = await db.collection("users").doc(decoded.uid).get();
      if (userDoc.exists) institutionId = userDoc.data()?.institutionId;
    }
    if (!institutionId) {
      institutionId = process.env.NEXT_PUBLIC_DEFAULT_INSTITUTION_ID || "ifs";
    }

    const snap = await db
      .collection("payments")
      .where("institutionId", "==", institutionId)
      .limit(100)
      .get();

    const payments = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ payments });
  } catch (err) {
    console.error("GET /api/payments error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
