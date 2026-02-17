import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCallerContext } from "@/lib/auth/get-caller-context";
import { getZoomCredentials } from "@/lib/zoom/config";
import { getZoomMeetingReport } from "@/lib/zoom/client";

/**
 * GET /api/zoom/meetings/:meetingId/report
 * Fetch participant report from Zoom Reports API.
 * Matches Zoom participants to platform users by email.
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

    const instDoc = await db
      .collection("institutions")
      .doc(meetingData.institutionId)
      .get();
    const creds = getZoomCredentials(instDoc.data()?.zoom);

    const report = await getZoomMeetingReport(creds, meetingData.zoomMeetingId);

    // Match participants to platform users
    const emailToUser = new Map<string, { uid: string; displayName: string; role: string }>();

    if (report.participants.length > 0) {
      const emails = report.participants
        .map((p) => p.user_email?.toLowerCase())
        .filter(Boolean);

      if (emails.length > 0) {
        // Batch lookup users by email
        const usersSnap = await db
          .collection("users")
          .where("institutionId", "==", meetingData.institutionId)
          .get();

        for (const userDoc of usersSnap.docs) {
          const user = userDoc.data();
          if (emails.includes(user.email?.toLowerCase())) {
            emailToUser.set(user.email.toLowerCase(), {
              uid: userDoc.id,
              displayName: user.displayName,
              role: user.role,
            });
          }
        }
      }
    }

    const enrichedParticipants = report.participants.map((p) => {
      const platformUser = emailToUser.get(p.user_email?.toLowerCase());
      return {
        ...p,
        durationMinutes: Math.round(p.duration / 60),
        platformUser: platformUser || null,
        isRegistered: !!platformUser,
      };
    });

    return NextResponse.json({
      report: {
        ...report,
        participants: enrichedParticipants,
      },
      summary: {
        totalParticipants: report.participants_count,
        registeredUsers: enrichedParticipants.filter((p) => p.isRegistered).length,
        unregisteredUsers: enrichedParticipants.filter((p) => !p.isRegistered).length,
        totalMinutes: report.total_minutes,
        avgDurationMinutes:
          report.participants_count > 0
            ? Math.round(report.total_minutes / report.participants_count)
            : 0,
      },
    });
  } catch (err) {
    console.error("GET meeting report error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
