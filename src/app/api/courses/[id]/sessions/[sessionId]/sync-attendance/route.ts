import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCallerContext } from "@/lib/auth/get-caller-context";
import { FieldValue } from "firebase-admin/firestore";
import { getMeetAttendance } from "@/lib/google/meet";

/**
 * POST /api/courses/:id/sessions/:sessionId/sync-attendance
 * Sync attendance from Google Meet participation data.
 * Instructor triggers this after a session ends.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const { id: courseId, sessionId } = await params;
    const caller = await getCallerContext(request.cookies.get("__session")?.value);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const allowedRoles = ["super_admin", "institution_admin", "instructor"];
    if (!allowedRoles.includes(caller.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getAdminDb();
    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const course = courseDoc.data()!;
    if (caller.role !== "super_admin" && course.institutionId !== caller.institutionId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (caller.role === "instructor" && !course.instructorIds?.includes(caller.uid)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get session document
    const sessionRef = db
      .collection("courses")
      .doc(courseId)
      .collection("sessions")
      .doc(sessionId);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const sessionData = sessionDoc.data()!;
    const platform = sessionData.meetingPlatform || "google_meet";

    if (platform === "google_meet" && !sessionData.meetLink) {
      return NextResponse.json(
        { error: "No Meet link associated with this session" },
        { status: 400 }
      );
    }

    if (platform === "zoom" && !sessionData.zoomMeetingUuid) {
      return NextResponse.json(
        { error: "No Zoom meeting associated with this session" },
        { status: 400 }
      );
    }

    // Get institution
    const instDoc = await db.collection("institutions").doc(course.institutionId).get();
    if (!instDoc.exists) {
      return NextResponse.json({ error: "Institution not found" }, { status: 404 });
    }
    const institution = instDoc.data()!;

    // Get enrolled students with their emails
    const enrollmentsSnap = await db
      .collection("enrollments")
      .where("courseId", "==", courseId)
      .where("status", "==", "active")
      .get();

    const enrolledEmails: { userId: string; email: string }[] = [];
    for (const enrollDoc of enrollmentsSnap.docs) {
      const enroll = enrollDoc.data();
      const userDoc = await db.collection("users").doc(enroll.userId).get();
      if (userDoc.exists) {
        enrolledEmails.push({
          userId: enroll.userId,
          email: userDoc.data()!.email,
        });
      }
    }

    // Build session time strings
    const sessionStartTime = `${sessionData.sessionDate}T${sessionData.startTime}:00+05:30`;
    const sessionEndTime = `${sessionData.sessionDate}T${sessionData.endTime}:00+05:30`;

    // Get attendance from the appropriate platform
    let attendance: { userId: string; email: string; status: string; joinedAt: string | null; leftAt: string | null; durationMinutes: number }[];
    let syncSource: string;

    if (platform === "zoom") {
      // Zoom attendance sync
      const { getZoomCredentials } = await import("@/lib/zoom/config");
      const { getZoomAttendance } = await import("@/lib/zoom/attendance");
      const zoomCreds = getZoomCredentials(institution.zoom);
      attendance = await getZoomAttendance(
        zoomCreds,
        sessionData.zoomMeetingUuid,
        sessionStartTime,
        sessionEndTime,
        enrolledEmails
      );
      syncSource = "Zoom";
    } else {
      // Google Meet attendance sync (default)
      const adminEmail = institution.googleWorkspace?.adminEmail;
      if (!adminEmail) {
        return NextResponse.json(
          { error: "Google Workspace admin email not configured" },
          { status: 500 }
        );
      }
      attendance = await getMeetAttendance(
        adminEmail,
        sessionData.meetLink,
        sessionStartTime,
        sessionEndTime,
        enrolledEmails
      );
      syncSource = "Meet";
    }

    // Save attendance records
    const batch = db.batch();
    const results: { userId: string; status: string; durationMinutes: number }[] = [];

    for (const record of attendance) {
      const docId = `${courseId}_${sessionData.sessionDate}_${record.userId}`;
      const ref = db.collection("attendance").doc(docId);

      batch.set(
        ref,
        {
          id: docId,
          courseId,
          userId: record.userId,
          institutionId: course.institutionId,
          sessionDate: sessionData.sessionDate,
          sessionId,
          status: record.status,
          joinedAt: record.joinedAt,
          leftAt: record.leftAt,
          durationMinutes: record.durationMinutes,
          syncedFromMeet: platform === "google_meet",
          syncedFromZoom: platform === "zoom",
          zoomMeetingId: platform === "zoom" ? sessionData.zoomMeetingId : null,
          zoomRegistrantId: null,
          markedBy: caller.uid,
          markedAt: FieldValue.serverTimestamp(),
          notes: null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      results.push({
        userId: record.userId,
        status: record.status,
        durationMinutes: record.durationMinutes,
      });
    }

    await batch.commit();

    // Update enrollment attendance counts
    for (const record of attendance) {
      const presentSnap = await db
        .collection("attendance")
        .where("courseId", "==", courseId)
        .where("userId", "==", record.userId)
        .where("status", "in", ["present", "late"])
        .get();

      const totalSnap = await db
        .collection("attendance")
        .where("courseId", "==", courseId)
        .where("userId", "==", record.userId)
        .get();

      const enrollSnap = await db
        .collection("enrollments")
        .where("courseId", "==", courseId)
        .where("userId", "==", record.userId)
        .where("status", "==", "active")
        .limit(1)
        .get();

      if (!enrollSnap.empty) {
        await enrollSnap.docs[0].ref.update({
          attendanceCount: presentSnap.size,
          totalSessions: totalSnap.size,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    return NextResponse.json({
      message: `Synced ${results.length} attendance records from ${syncSource}`,
      results,
      summary: {
        present: results.filter((r) => r.status === "present").length,
        late: results.filter((r) => r.status === "late").length,
        absent: results.filter((r) => r.status === "absent").length,
      },
    });
  } catch (err) {
    console.error("POST sync-attendance error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
