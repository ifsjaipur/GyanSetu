import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { createMeetSession } from "@/lib/google/calendar";

/**
 * GET /api/courses/:id/sessions
 * List bootcamp sessions for a course.
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

    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const course = courseDoc.data()!;
    if (decoded.role !== "super_admin" && course.institutionId !== decoded.institutionId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Return sessions from bootcampConfig, plus any stored session docs
    const sessionsSnap = await db
      .collection("courses")
      .doc(courseId)
      .collection("sessions")
      .orderBy("sessionDate", "asc")
      .get();

    const sessions = sessionsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ sessions, bootcampConfig: course.bootcampConfig || null });
  } catch (err) {
    console.error("GET sessions error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/courses/:id/sessions
 * Create a new bootcamp session with Google Calendar event + Meet link.
 *
 * Body: { sessionDate, startTime, endTime, topic, timeZone? }
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
    const { sessionDate, startTime, endTime, topic, timeZone } = body;

    if (!sessionDate || !startTime || !endTime || !topic) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Fetch institution for Google credentials
    const instDoc = await db.collection("institutions").doc(course.institutionId).get();
    if (!instDoc.exists) {
      return NextResponse.json({ error: "Institution not found" }, { status: 404 });
    }

    const institution = instDoc.data()!;
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    const adminEmail = institution.googleWorkspace?.adminEmail;

    // Get enrolled student emails for attendees
    const enrollmentsSnap = await db
      .collection("enrollments")
      .where("courseId", "==", courseId)
      .where("status", "==", "active")
      .get();

    const studentUids = enrollmentsSnap.docs.map((d) => d.data().userId);
    const attendeeEmails: string[] = [];

    if (studentUids.length > 0) {
      // Batch fetch user emails
      const userDocs = await Promise.all(
        studentUids.map((uid) => db.collection("users").doc(uid).get())
      );
      userDocs.forEach((doc) => {
        if (doc.exists) attendeeEmails.push(doc.data()!.email);
      });
    }

    let calendarEventId: string | null = null;
    let meetLink: string | null = null;

    // Create Calendar event with Meet link if credentials are configured
    if (serviceAccountKey && adminEmail) {
      try {
        const tz = timeZone || "Asia/Kolkata";
        const result = await createMeetSession(serviceAccountKey, adminEmail, {
          summary: `${course.title}: ${topic}`,
          description: `Bootcamp session for ${course.title}`,
          startTime: `${sessionDate}T${startTime}:00`,
          endTime: `${sessionDate}T${endTime}:00`,
          timeZone: tz,
          attendeeEmails,
          requestId: `session-${courseId}-${sessionDate}-${Date.now()}`,
        });
        calendarEventId = result.eventId;
        meetLink = result.meetLink;
      } catch (err) {
        console.error("Calendar event creation failed:", err);
        // Continue without calendar — session will be created without Meet link
      }
    }

    // Save session document
    const sessionRef = db.collection("courses").doc(courseId).collection("sessions").doc();
    const sessionData = {
      id: sessionRef.id,
      courseId,
      institutionId: course.institutionId,
      sessionDate,
      startTime,
      endTime,
      topic,
      calendarEventId,
      meetLink,
      attendeeCount: attendeeEmails.length,
      createdBy: decoded.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await sessionRef.set(sessionData);

    // Add calendarEventId to course bootcampConfig
    if (calendarEventId) {
      await db
        .collection("courses")
        .doc(courseId)
        .update({
          "bootcampConfig.calendarEventIds": FieldValue.arrayUnion(calendarEventId),
          updatedAt: FieldValue.serverTimestamp(),
        });
    }

    return NextResponse.json({
      session: { ...sessionData, createdAt: new Date().toISOString() },
    });
  } catch (err) {
    console.error("POST sessions error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
