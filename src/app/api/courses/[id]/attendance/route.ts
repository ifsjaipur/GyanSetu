import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * GET /api/courses/:id/attendance
 * List attendance records for a course.
 * Instructors see all students; students see only their own.
 * Query params: ?sessionDate=YYYY-MM-DD
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: courseId } = await params;
    const sessionCookie = request.cookies.get("__session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const db = getAdminDb();

    // Treat missing role as student (claims may not have propagated yet for new users)
    const role = decoded.role || "student";

    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const course = courseDoc.data()!;
    if (role !== "super_admin" && course.institutionId !== decoded.institutionId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let query = db
      .collection("attendance")
      .where("courseId", "==", courseId);

    // Students only see their own
    if (role === "student") {
      query = query.where("userId", "==", decoded.uid);
    }

    const { searchParams } = request.nextUrl;
    const sessionDate = searchParams.get("sessionDate");
    if (sessionDate) {
      query = query.where("sessionDate", "==", sessionDate);
    }

    const snap = await query.orderBy("sessionDate", "desc").limit(500).get();
    const records = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ attendance: records });
  } catch (err) {
    console.error("GET attendance error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/courses/:id/attendance
 * Mark attendance for one or more students for a session.
 * Instructor/Admin only.
 *
 * Body: { sessionDate, records: [{ userId, status, notes? }] }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: courseId } = await params;
    const sessionCookie = request.cookies.get("__session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const allowedRoles = ["super_admin", "institution_admin", "instructor"];
    if (!allowedRoles.includes(decoded.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getAdminDb();
    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const course = courseDoc.data()!;
    if (decoded.role !== "super_admin" && course.institutionId !== decoded.institutionId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (decoded.role === "instructor" && !course.instructorIds?.includes(decoded.uid)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { sessionDate, records } = body;

    if (!sessionDate || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { error: "Missing sessionDate or records" },
        { status: 400 }
      );
    }

    const validStatuses = ["present", "absent", "late", "excused"];
    const batch = db.batch();
    const created: string[] = [];

    for (const record of records) {
      if (!record.userId || !validStatuses.includes(record.status)) {
        continue;
      }

      // Use deterministic doc ID: courseId_sessionDate_userId
      const docId = `${courseId}_${sessionDate}_${record.userId}`;
      const ref = db.collection("attendance").doc(docId);

      batch.set(
        ref,
        {
          id: docId,
          courseId,
          userId: record.userId,
          institutionId: course.institutionId,
          sessionDate,
          calendarEventId: record.calendarEventId || null,
          meetingCode: null,
          status: record.status,
          joinedAt: null,
          leftAt: null,
          durationMinutes: null,
          markedBy: decoded.uid,
          markedAt: FieldValue.serverTimestamp(),
          notes: record.notes || null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      created.push(docId);
    }

    await batch.commit();

    // Update enrollment attendance counts for affected users
    const userIds = records.map((r: { userId: string }) => r.userId);
    for (const userId of userIds) {
      // Count all present/late records for this user in this course
      const presentSnap = await db
        .collection("attendance")
        .where("courseId", "==", courseId)
        .where("userId", "==", userId)
        .where("status", "in", ["present", "late"])
        .get();

      // Count total sessions for this course
      const totalSnap = await db
        .collection("attendance")
        .where("courseId", "==", courseId)
        .where("userId", "==", userId)
        .get();

      // Update enrollment
      const enrollSnap = await db
        .collection("enrollments")
        .where("courseId", "==", courseId)
        .where("userId", "==", userId)
        .where("status", "==", "active")
        .limit(1)
        .get();

      if (!enrollSnap.empty) {
        const enrollRef = enrollSnap.docs[0].ref;
        await enrollRef.update({
          attendanceCount: presentSnap.size,
          totalSessions: totalSnap.size,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    return NextResponse.json({
      message: `Marked ${created.length} attendance records`,
      ids: created,
    });
  } catch (err) {
    console.error("POST attendance error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
