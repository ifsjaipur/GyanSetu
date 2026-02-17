import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { createMeetSession, deleteCalendarEvent } from "@/lib/google/calendar";
import { getServiceAccountCredentials } from "@/lib/google/auth-client";
import { getCallerContext } from "@/lib/auth/get-caller-context";

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
    const caller = await getCallerContext(request.cookies.get("__session")?.value);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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

    const body = await request.json();
    const { sessionDate, startTime, endTime, topic, timeZone, meetingPlatform, customMeetLink } = body;

    if (!sessionDate || !startTime || !endTime || !topic) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // meetingPlatform: "google_meet" (default) | "zoom" | "ms_teams" | "custom_link"
    const platform = meetingPlatform || "google_meet";

    // Fetch institution for Google credentials
    const instDoc = await db.collection("institutions").doc(course.institutionId).get();
    if (!instDoc.exists) {
      return NextResponse.json({ error: "Institution not found" }, { status: 404 });
    }

    const institution = instDoc.data()!;
    const adminEmail = institution.googleWorkspace?.adminEmail;

    // Validate required credentials for auto-create platforms
    if (platform === "google_meet") {
      if (!getServiceAccountCredentials()) {
        return NextResponse.json(
          { error: "Google service account is not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY." },
          { status: 400 }
        );
      }
      if (!adminEmail) {
        return NextResponse.json(
          { error: "Google Workspace admin email is not configured for this institution. Set it in institution settings." },
          { status: 400 }
        );
      }
    }

    // Get instructor emails for co-host / alternative host
    const instructorIds: string[] = course.instructorIds || [];
    const instructorEmails: string[] = [];

    if (instructorIds.length > 0) {
      const instructorDocs = await Promise.all(
        instructorIds.map((uid) => db.collection("users").doc(uid).get())
      );
      instructorDocs.forEach((doc) => {
        if (doc.exists && doc.data()!.email) {
          instructorEmails.push(doc.data()!.email);
        }
      });
    }

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
    let zoomMeetingId: number | null = null;
    let zoomMeetingUuid: string | null = null;

    // For platforms without API integration, use the custom link directly
    if (!["google_meet", "zoom"].includes(platform) && customMeetLink) {
      meetLink = customMeetLink;
    }

    // Create Calendar event with Meet link if using Google Meet
    if (platform === "google_meet") {
      try {
        const tz = timeZone || "Asia/Kolkata";
        const result = await createMeetSession(adminEmail!, {
          summary: `${course.title}: ${topic}`,
          description: `Bootcamp session for ${course.title}`,
          startTime: `${sessionDate}T${startTime}:00`,
          endTime: `${sessionDate}T${endTime}:00`,
          timeZone: tz,
          attendeeEmails,
          coHostEmails: instructorEmails,
          requestId: `session-${courseId}-${sessionDate}-${Date.now()}`,
        });
        calendarEventId = result.eventId;
        meetLink = result.meetLink;
      } catch (err) {
        console.error("Calendar event creation failed:", err);
        const message = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json(
          { error: `Failed to create Google Meet link: ${message}` },
          { status: 500 }
        );
      }
    }

    // Create Zoom meeting if using Zoom
    if (platform === "zoom") {
      try {
        const { getZoomCredentials } = await import("@/lib/zoom/config");
        const { createZoomMeeting, addZoomRegistrant } = await import("@/lib/zoom/client");

        const zoomCreds = getZoomCredentials(institution.zoom);

        // Calculate duration in minutes
        const [startH, startM] = startTime.split(":").map(Number);
        const [endH, endM] = endTime.split(":").map(Number);
        const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);

        const tz = timeZone || "Asia/Kolkata";
        const meeting = await createZoomMeeting(zoomCreds, {
          topic: `${course.title}: ${topic}`,
          startTime: `${sessionDate}T${startTime}:00`,
          duration: durationMinutes,
          timezone: tz,
          agenda: `Bootcamp session for ${course.title}`,
          registrationRequired: true,
        });

        meetLink = meeting.join_url;
        zoomMeetingId = meeting.id;
        zoomMeetingUuid = meeting.uuid;

        // Pre-register enrolled students
        for (const email of attendeeEmails) {
          try {
            const nameParts = email.split("@")[0].split(".");
            const firstName = nameParts[0] || "Student";
            const lastName = nameParts.slice(1).join(" ") || "User";
            await addZoomRegistrant(zoomCreds, meeting.id, email, firstName, lastName);
          } catch (regErr) {
            console.warn(`Failed to register ${email} for Zoom meeting:`, regErr);
          }
        }
      } catch (err) {
        console.error("Zoom meeting creation failed:", err);
        const message = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json(
          { error: `Failed to create Zoom meeting: ${message}` },
          { status: 500 }
        );
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
      meetingPlatform: platform,
      calendarEventId,
      meetLink,
      zoomMeetingId,
      zoomMeetingUuid,
      attendeeCount: attendeeEmails.length,
      createdBy: caller.uid,
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

/**
 * DELETE /api/courses/:id/sessions
 * Delete a bootcamp session and its associated Calendar event.
 *
 * Body: { sessionId }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: courseId } = await params;
    const caller = await getCallerContext(request.cookies.get("__session")?.value);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const allowedRoles = ["super_admin", "institution_admin", "instructor"];
    if (!allowedRoles.includes(caller.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getAdminDb();
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

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

    // Get session doc to find calendar event ID
    const sessionRef = db.collection("courses").doc(courseId).collection("sessions").doc(sessionId);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const sessionData = sessionDoc.data()!;

    // Delete Calendar event if it exists
    if (sessionData.calendarEventId) {
      const instDoc = await db.collection("institutions").doc(course.institutionId).get();
      const adminEmail = instDoc.data()?.googleWorkspace?.adminEmail;

      if (getServiceAccountCredentials() && adminEmail) {
        try {
          await deleteCalendarEvent(adminEmail, sessionData.calendarEventId);
        } catch (err) {
          console.error("Failed to delete calendar event:", err);
        }
      }

      await db.collection("courses").doc(courseId).update({
        "bootcampConfig.calendarEventIds": FieldValue.arrayRemove(sessionData.calendarEventId),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // Delete Zoom meeting if it exists
    if (sessionData.meetingPlatform === "zoom" && sessionData.zoomMeetingId) {
      try {
        const { getZoomCredentials } = await import("@/lib/zoom/config");
        const { deleteZoomMeeting } = await import("@/lib/zoom/client");
        const instDoc = await db.collection("institutions").doc(course.institutionId).get();
        const zoomCreds = getZoomCredentials(instDoc.data()?.zoom);
        await deleteZoomMeeting(zoomCreds, sessionData.zoomMeetingId);
      } catch (err) {
        console.error("Failed to delete Zoom meeting:", err);
      }
    }

    // Delete session doc
    await sessionRef.delete();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE sessions error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
