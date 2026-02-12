import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * POST /api/enrollments/:id/progress
 * Mark a lesson as completed and update enrollment progress.
 *
 * Body: { lessonId, moduleId, courseId }
 *
 * Returns updated progress object.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: enrollmentId } = await params;
    const sessionCookie = request.cookies.get("__session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const db = getAdminDb();

    // Verify enrollment exists and belongs to user
    const enrollmentRef = db.collection("enrollments").doc(enrollmentId);
    const enrollmentDoc = await enrollmentRef.get();

    if (!enrollmentDoc.exists) {
      return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
    }

    const enrollment = enrollmentDoc.data()!;
    if (enrollment.userId !== decoded.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (enrollment.status !== "active") {
      return NextResponse.json({ error: "Enrollment is not active" }, { status: 400 });
    }

    const body = await request.json();
    const { lessonId, moduleId, courseId } = body;

    if (!lessonId || !moduleId || !courseId) {
      return NextResponse.json({ error: "Missing lessonId, moduleId, or courseId" }, { status: 400 });
    }

    // Get the course to count total lessons and modules
    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Get current completed lessons list (stored as array on enrollment)
    const completedLessonIds: string[] = enrollment.completedLessonIds || [];

    // If already completed, just update lastAccessedAt
    if (completedLessonIds.includes(lessonId)) {
      await enrollmentRef.update({
        "progress.lastAccessedAt": FieldValue.serverTimestamp(),
        "progress.lastLessonId": lessonId,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        progress: enrollment.progress,
        alreadyCompleted: true,
      });
    }

    // Add lesson to completed list
    const newCompletedLessons = [...completedLessonIds, lessonId];

    // Count total lessons across all modules
    const modulesSnap = await db
      .collection("courses")
      .doc(courseId)
      .collection("modules")
      .get();

    let totalLessons = 0;
    const moduleCompletionMap: Record<string, { total: number; completed: number }> = {};

    await Promise.all(
      modulesSnap.docs.map(async (modDoc) => {
        const lessonsSnap = await db
          .collection("courses")
          .doc(courseId)
          .collection("modules")
          .doc(modDoc.id)
          .collection("lessons")
          .get();

        const modTotal = lessonsSnap.size;
        totalLessons += modTotal;

        const modCompleted = lessonsSnap.docs.filter((l) =>
          newCompletedLessons.includes(l.id)
        ).length;

        moduleCompletionMap[modDoc.id] = { total: modTotal, completed: modCompleted };
      })
    );

    const completedLessonsCount = newCompletedLessons.length;
    const completedModulesCount = Object.values(moduleCompletionMap).filter(
      (m) => m.total > 0 && m.completed === m.total
    ).length;
    const totalModules = modulesSnap.size;
    const percentComplete = totalLessons > 0
      ? Math.round((completedLessonsCount / totalLessons) * 100)
      : 0;

    const updatedProgress = {
      completedLessons: completedLessonsCount,
      totalLessons,
      completedModules: completedModulesCount,
      totalModules,
      percentComplete,
      lastAccessedAt: FieldValue.serverTimestamp(),
      lastLessonId: lessonId,
    };

    await enrollmentRef.update({
      completedLessonIds: newCompletedLessons,
      progress: updatedProgress,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      progress: {
        ...updatedProgress,
        lastAccessedAt: new Date().toISOString(),
      },
      completedLessonIds: newCompletedLessons,
      alreadyCompleted: false,
    });
  } catch (err) {
    console.error("POST /api/enrollments/:id/progress error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/enrollments/:id/progress
 * Get the list of completed lesson IDs for an enrollment.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: enrollmentId } = await params;
    const sessionCookie = request.cookies.get("__session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const db = getAdminDb();

    const enrollmentDoc = await db.collection("enrollments").doc(enrollmentId).get();
    if (!enrollmentDoc.exists) {
      return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
    }

    const enrollment = enrollmentDoc.data()!;

    // Students can only view their own; admins/instructors can view any in institution
    // Treat missing role as student (claims may not have propagated yet for new users)
    const role = decoded.role || "student";
    if (enrollment.userId !== decoded.uid) {
      const isAdminOrInstructor = ["super_admin", "institution_admin", "instructor"].includes(role);
      if (!isAdminOrInstructor || (role !== "super_admin" && enrollment.institutionId !== decoded.institutionId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json({
      progress: enrollment.progress,
      completedLessonIds: enrollment.completedLessonIds || [],
    });
  } catch (err) {
    console.error("GET /api/enrollments/:id/progress error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
