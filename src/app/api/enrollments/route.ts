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

    // Treat missing role as student (claims may not have propagated yet for new users)
    const role = decoded.role || "student";

    let query = db
      .collection("enrollments")
      .where("institutionId", "==", institutionId);

    // Students only see their own enrollments
    if (role === "student") {
      query = query.where("userId", "==", decoded.uid);
    } else {
      const userIdFilter = searchParams.get("userId");
      if (userIdFilter) {
        query = query.where("userId", "==", userIdFilter);
      }
    }

    // courseId filter works for all roles
    const courseIdFilter = searchParams.get("courseId");
    if (courseIdFilter) {
      query = query.where("courseId", "==", courseIdFilter);
    }

    const snap = await query.limit(100).get();
    const enrollments = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Enrich with course info if ?include=course is set (avoids N+1 on dashboard)
    const include = searchParams.get("include");
    if (include === "course" && enrollments.length > 0) {
      // Batch-fetch unique course docs
      const courseIds = [...new Set(
        enrollments.map((e) => (e as unknown as { courseId: string }).courseId).filter(Boolean)
      )];
      const courseDocs = await Promise.all(
        courseIds.map((id) => db.collection("courses").doc(id).get())
      );
      const courseMap = new Map<string, { title: string; type: string; thumbnailUrl: string }>();
      courseDocs.forEach((doc) => {
        if (doc.exists) {
          const d = doc.data()!;
          courseMap.set(doc.id, { title: d.title, type: d.type, thumbnailUrl: d.thumbnailUrl || "" });
        }
      });

      const enriched = enrollments.map((e) => {
        const courseId = (e as unknown as { courseId: string }).courseId;
        const course = courseId ? courseMap.get(courseId) : undefined;
        return course
          ? { ...e, courseTitle: course.title, courseType: course.type, courseThumbnailUrl: course.thumbnailUrl }
          : e;
      });

      return NextResponse.json({ enrollments: enriched });
    }

    return NextResponse.json({ enrollments });
  } catch (err) {
    console.error("GET /api/enrollments error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
