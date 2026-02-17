import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCallerContext } from "@/lib/auth/get-caller-context";
import { getZoomCredentials } from "@/lib/zoom/config";
import {
  getZoomMeeting,
  updateZoomMeeting,
  deleteZoomMeeting,
} from "@/lib/zoom/client";
import { FieldValue } from "firebase-admin/firestore";

/**
 * GET /api/zoom/meetings/:meetingId
 * Get meeting details from Firestore + live Zoom API.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;
    const caller = await getCallerContext(request.cookies.get("__session")?.value);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const db = getAdminDb();

    // Get from Firestore
    const meetingDoc = await db.collection("zoomMeetings").doc(meetingId).get();
    if (!meetingDoc.exists) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const meetingData = meetingDoc.data()!;
    if (caller.role !== "super_admin" && meetingData.institutionId !== caller.institutionId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get live participants from subcollection
    const participantsSnap = await db
      .collection("zoomMeetings")
      .doc(meetingId)
      .collection("participants")
      .orderBy("joinTime", "desc")
      .get();

    const participants = participantsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Optionally fetch latest status from Zoom API
    let zoomLiveData = null;
    if (meetingData.status === "scheduled" || meetingData.status === "started") {
      try {
        const instDoc = await db
          .collection("institutions")
          .doc(meetingData.institutionId)
          .get();
        const creds = getZoomCredentials(instDoc.data()?.zoom);
        zoomLiveData = await getZoomMeeting(creds, meetingData.zoomMeetingId);
      } catch {
        // Meeting may have ended or not yet started
      }
    }

    return NextResponse.json({
      meeting: { id: meetingDoc.id, ...meetingData },
      participants,
      zoomLiveData,
    });
  } catch (err) {
    console.error("GET zoom/meetings/:id error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/zoom/meetings/:meetingId
 * Update meeting via Zoom API + Firestore.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;
    const caller = await getCallerContext(request.cookies.get("__session")?.value);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const allowedRoles = ["super_admin", "institution_admin", "instructor"];
    if (!allowedRoles.includes(caller.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getAdminDb();
    const meetingDoc = await db.collection("zoomMeetings").doc(meetingId).get();
    if (!meetingDoc.exists) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const meetingData = meetingDoc.data()!;
    if (caller.role !== "super_admin" && meetingData.institutionId !== caller.institutionId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const instDoc = await db
      .collection("institutions")
      .doc(meetingData.institutionId)
      .get();
    const creds = getZoomCredentials(instDoc.data()?.zoom);

    await updateZoomMeeting(creds, meetingData.zoomMeetingId, body);

    // Update Firestore
    const firestoreUpdates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (body.topic) firestoreUpdates.topic = body.topic;
    if (body.startTime) firestoreUpdates.startTime = body.startTime;
    if (body.duration) firestoreUpdates.duration = body.duration;
    if (body.timezone) firestoreUpdates.timezone = body.timezone;

    await meetingDoc.ref.update(firestoreUpdates);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH zoom/meetings/:id error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/zoom/meetings/:meetingId
 * Delete meeting from Zoom + Firestore.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;
    const caller = await getCallerContext(request.cookies.get("__session")?.value);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const allowedRoles = ["super_admin", "institution_admin"];
    if (!allowedRoles.includes(caller.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getAdminDb();
    const meetingDoc = await db.collection("zoomMeetings").doc(meetingId).get();
    if (!meetingDoc.exists) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const meetingData = meetingDoc.data()!;
    if (caller.role !== "super_admin" && meetingData.institutionId !== caller.institutionId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete from Zoom
    try {
      const instDoc = await db
        .collection("institutions")
        .doc(meetingData.institutionId)
        .get();
      const creds = getZoomCredentials(instDoc.data()?.zoom);
      await deleteZoomMeeting(creds, meetingData.zoomMeetingId);
    } catch (err) {
      console.error("Failed to delete Zoom meeting:", err);
    }

    // Delete participants subcollection
    const participantsSnap = await db
      .collection("zoomMeetings")
      .doc(meetingId)
      .collection("participants")
      .get();
    const batch = db.batch();
    participantsSnap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    // Delete meeting document
    await meetingDoc.ref.delete();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE zoom/meetings/:id error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
