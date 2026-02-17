import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCallerContext } from "@/lib/auth/get-caller-context";
import { getZoomCredentials } from "@/lib/zoom/config";
import { createZoomMeeting, addZoomRegistrant } from "@/lib/zoom/client";
import { FieldValue } from "firebase-admin/firestore";
import { createZoomMeetingSchema } from "@shared/validators/zoom.validator";

/**
 * GET /api/zoom/meetings
 * List all Zoom meetings for the institution.
 */
export async function GET(request: NextRequest) {
  try {
    const caller = await getCallerContext(request.cookies.get("__session")?.value);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const allowedRoles = ["super_admin", "institution_admin", "instructor"];
    if (!allowedRoles.includes(caller.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getAdminDb();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // "scheduled" | "started" | "ended"
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    let query = db
      .collection("zoomMeetings")
      .where("institutionId", "==", caller.institutionId)
      .orderBy("startTime", "desc")
      .limit(limit);

    if (status) {
      query = query.where("status", "==", status);
    }

    const snap = await query.get();
    const meetings = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ meetings });
  } catch (err) {
    console.error("GET zoom/meetings error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/zoom/meetings
 * Create a standalone Zoom meeting (not linked to a course session).
 */
export async function POST(request: NextRequest) {
  try {
    const caller = await getCallerContext(request.cookies.get("__session")?.value);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const allowedRoles = ["super_admin", "institution_admin", "instructor"];
    if (!allowedRoles.includes(caller.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createZoomMeetingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const instDoc = await db.collection("institutions").doc(caller.institutionId).get();
    if (!instDoc.exists) {
      return NextResponse.json({ error: "Institution not found" }, { status: 404 });
    }

    const institution = instDoc.data()!;
    const creds = getZoomCredentials(institution.zoom);
    const meeting = await createZoomMeeting(creds, parsed.data);

    // Calculate end time
    const startDate = new Date(parsed.data.startTime);
    const endDate = new Date(startDate.getTime() + parsed.data.duration * 60 * 1000);

    // Store in Firestore
    const meetingRef = db.collection("zoomMeetings").doc(String(meeting.id));
    const meetingRecord = {
      id: meetingRef.id,
      zoomMeetingId: meeting.id,
      zoomMeetingUuid: meeting.uuid,
      institutionId: caller.institutionId,
      courseId: parsed.data.courseId || null,
      sessionId: parsed.data.sessionId || null,
      topic: meeting.topic,
      startTime: meeting.start_time,
      endTime: endDate.toISOString(),
      duration: meeting.duration,
      timezone: meeting.timezone,
      joinUrl: meeting.join_url,
      startUrl: meeting.start_url,
      password: meeting.password,
      registrationRequired: parsed.data.registrationRequired,
      status: "scheduled" as const,
      hostEmail: creds.defaultUserId,
      participantCount: 0,
      registrantCount: 0,
      liveParticipantCount: 0,
      createdBy: caller.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await meetingRef.set(meetingRecord);

    // If courseId provided, pre-register enrolled students
    if (parsed.data.courseId) {
      const enrollmentsSnap = await db
        .collection("enrollments")
        .where("courseId", "==", parsed.data.courseId)
        .where("status", "==", "active")
        .get();

      let registrantCount = 0;
      for (const enrollDoc of enrollmentsSnap.docs) {
        const enroll = enrollDoc.data();
        const userDoc = await db.collection("users").doc(enroll.userId).get();
        if (!userDoc.exists) continue;
        const user = userDoc.data()!;
        try {
          const nameParts = (user.displayName || user.email.split("@")[0]).split(" ");
          await addZoomRegistrant(
            creds,
            meeting.id,
            user.email,
            nameParts[0] || "Student",
            nameParts.slice(1).join(" ") || "User"
          );
          registrantCount++;
        } catch (regErr) {
          console.warn(`Failed to register ${user.email}:`, regErr);
        }
      }

      if (registrantCount > 0) {
        await meetingRef.update({ registrantCount });
      }
    }

    return NextResponse.json({
      meeting: { ...meetingRecord, createdAt: new Date().toISOString() },
    });
  } catch (err) {
    console.error("POST zoom/meetings error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
