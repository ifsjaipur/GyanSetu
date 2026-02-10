import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

/**
 * GET /api/enrollments
 * List enrollments. Students see their own; admins/instructors see all in institution.
 * Query params: ?courseId=xxx, ?userId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("__session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const db = getAdminDb();
    const { searchParams } = request.nextUrl;

    let institutionId = decoded.institutionId;
    if (!institutionId) {
      const userDoc = await db.collection("users").doc(decoded.uid).get();
      if (userDoc.exists) institutionId = userDoc.data()?.institutionId;
    }
    if (!institutionId) {
      institutionId = process.env.NEXT_PUBLIC_DEFAULT_INSTITUTION_ID || "ifs";
    }

    let query = db
      .collection("enrollments")
      .where("institutionId", "==", institutionId);

    // Students only see their own enrollments
    if (decoded.role === "student") {
      query = query.where("userId", "==", decoded.uid);
    } else {
      const userIdFilter = searchParams.get("userId");
      if (userIdFilter) {
        query = query.where("userId", "==", userIdFilter);
      }

      const courseIdFilter = searchParams.get("courseId");
      if (courseIdFilter) {
        query = query.where("courseId", "==", courseIdFilter);
      }
    }

    const snap = await query.limit(100).get();
    const enrollments = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ enrollments });
  } catch (err) {
    console.error("GET /api/enrollments error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
