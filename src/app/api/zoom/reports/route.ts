import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCallerContext } from "@/lib/auth/get-caller-context";

/**
 * GET /api/zoom/reports
 * Aggregated Zoom meeting reports.
 *
 * Query params:
 * - from: start date (YYYY-MM-DD)
 * - to: end date (YYYY-MM-DD)
 * - courseId: filter by course
 */
export async function GET(request: NextRequest) {
  try {
    const caller = await getCallerContext(request.cookies.get("__session")?.value);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const allowedRoles = ["super_admin", "institution_admin"];
    if (!allowedRoles.includes(caller.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getAdminDb();
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const courseId = searchParams.get("courseId");

    let query = db
      .collection("zoomMeetings")
      .where("institutionId", "==", caller.institutionId)
      .orderBy("startTime", "desc");

    if (from) {
      query = query.where("startTime", ">=", from);
    }
    if (to) {
      query = query.where("startTime", "<=", `${to}T23:59:59`);
    }
    if (courseId) {
      query = query.where("courseId", "==", courseId);
    }

    const snap = await query.limit(200).get();
    const meetings = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Aggregate stats
    const totalMeetings = meetings.length;
    const totalParticipants = meetings.reduce(
      (sum, m) => sum + ((m as unknown as { participantCount?: number }).participantCount || 0),
      0
    );
    const totalRegistrants = meetings.reduce(
      (sum, m) => sum + ((m as unknown as { registrantCount?: number }).registrantCount || 0),
      0
    );
    const completedMeetings = meetings.filter(
      (m) => (m as unknown as { status?: string }).status === "ended"
    ).length;

    return NextResponse.json({
      meetings,
      summary: {
        totalMeetings,
        completedMeetings,
        totalParticipants,
        totalRegistrants,
        avgParticipantsPerMeeting:
          completedMeetings > 0
            ? Math.round(totalParticipants / completedMeetings)
            : 0,
      },
    });
  } catch (err) {
    console.error("GET zoom/reports error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
