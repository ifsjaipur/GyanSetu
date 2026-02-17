import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCallerContext } from "@/lib/auth/get-caller-context";
import { getZoomCredentials } from "@/lib/zoom/config";
import { listZoomRegistrants, addZoomRegistrant } from "@/lib/zoom/client";
import { addZoomRegistrantSchema } from "@shared/validators/zoom.validator";
import { FieldValue } from "firebase-admin/firestore";

/**
 * GET /api/zoom/meetings/:meetingId/registrants
 * List all registrants for a Zoom meeting.
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

    const meetingDoc = await db.collection("zoomMeetings").doc(meetingId).get();
    if (!meetingDoc.exists) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const meetingData = meetingDoc.data()!;
    if (caller.role !== "super_admin" && meetingData.institutionId !== caller.institutionId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const instDoc = await db
      .collection("institutions")
      .doc(meetingData.institutionId)
      .get();
    const creds = getZoomCredentials(instDoc.data()?.zoom);
    const registrants = await listZoomRegistrants(
      creds,
      meetingData.zoomMeetingId
    );

    return NextResponse.json({ registrants });
  } catch (err) {
    console.error("GET registrants error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/zoom/meetings/:meetingId/registrants
 * Add a registrant to a Zoom meeting.
 */
export async function POST(
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

    const body = await request.json();
    const parsed = addZoomRegistrantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
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

    const instDoc = await db
      .collection("institutions")
      .doc(meetingData.institutionId)
      .get();
    const creds = getZoomCredentials(instDoc.data()?.zoom);

    const registrant = await addZoomRegistrant(
      creds,
      meetingData.zoomMeetingId,
      parsed.data.email,
      parsed.data.firstName,
      parsed.data.lastName
    );

    // Update registrant count
    await meetingDoc.ref.update({
      registrantCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ registrant });
  } catch (err) {
    console.error("POST registrants error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
