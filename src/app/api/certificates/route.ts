import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

/**
 * GET /api/certificates
 * List certificates. Students see their own; admins/instructors see all in institution.
 */
export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("__session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const db = getAdminDb();

    // Treat missing role as student (claims may not have propagated yet for new users)
    const role = decoded.role || "student";

    let institutionId = decoded.institutionId;
    if (!institutionId) {
      const userDoc = await db.collection("users").doc(decoded.uid).get();
      if (userDoc.exists) institutionId = userDoc.data()?.institutionId;
    }
    if (!institutionId) {
      institutionId = process.env.NEXT_PUBLIC_DEFAULT_INSTITUTION_ID || "ifs";
    }

    let query = db
      .collection("certificates")
      .where("institutionId", "==", institutionId);

    if (role === "student") {
      query = query.where("userId", "==", decoded.uid);
    }

    const snap = await query.orderBy("createdAt", "desc").limit(100).get();
    const certificates = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ certificates });
  } catch (err) {
    console.error("GET certificates error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
