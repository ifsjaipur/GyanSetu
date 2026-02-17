import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCallerContext } from "@/lib/auth/get-caller-context";

/**
 * GET /api/enrollments
 * List enrollments. Students see their own; admins/instructors see all in institution.
 * Query params: ?courseId=xxx, ?userId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const caller = await getCallerContext(request.cookies.get("__session")?.value);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const db = getAdminDb();
    const { searchParams } = request.nextUrl;

    let query = db
      .collection("enrollments")
      .where("institutionId", "==", caller.institutionId);

    // Students only see their own enrollments; ?mine=true forces own-only for any role
    const mineOnly = searchParams.get("mine") === "true";
    if (caller.role === "student" || mineOnly) {
      query = query.where("userId", "==", caller.uid);
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

    // Enrich with course/user info based on ?include= param
    // include=course — dashboard card enrichment (course title, type, thumbnail)
    // include=all — admin panel enrichment (course title + user name/email)
    const include = searchParams.get("include");
    if ((include === "course" || include === "all") && enrollments.length > 0) {
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

      // Also fetch user info for admin enrichment
      let userMap = new Map<string, { displayName: string; email: string }>();
      if (include === "all") {
        const userIds = [...new Set(
          enrollments.map((e) => (e as unknown as { userId: string }).userId).filter(Boolean)
        )];
        // Firestore getAll supports up to 100 refs
        if (userIds.length > 0) {
          const userRefs = userIds.map((id) => db.collection("users").doc(id));
          const userDocs = await db.getAll(...userRefs);
          userDocs.forEach((doc) => {
            if (doc.exists) {
              const d = doc.data()!;
              userMap.set(doc.id, {
                displayName: d.displayName || d.email || doc.id,
                email: d.email || "",
              });
            }
          });
        }
      }

      // Filter out enrollments whose course no longer exists (orphaned after reset)
      const enriched = enrollments
        .map((e) => {
          const courseId = (e as unknown as { courseId: string }).courseId;
          const userId = (e as unknown as { userId: string }).userId;
          const course = courseId ? courseMap.get(courseId) : undefined;
          if (!course) return null; // Course was deleted — skip this enrollment

          const user = userId ? userMap.get(userId) : undefined;
          return {
            ...e,
            courseTitle: course.title,
            courseType: course.type,
            courseThumbnailUrl: course.thumbnailUrl,
            ...(user ? { userName: user.displayName, userEmail: user.email } : {}),
          };
        })
        .filter(Boolean);

      const response = NextResponse.json({ enrollments: enriched });
      response.headers.set("Cache-Control", "private, max-age=10, stale-while-revalidate=30");
      return response;
    }

    const response = NextResponse.json({ enrollments });
    response.headers.set("Cache-Control", "private, max-age=10, stale-while-revalidate=30");
    return response;
  } catch (err) {
    console.error("GET /api/enrollments error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
