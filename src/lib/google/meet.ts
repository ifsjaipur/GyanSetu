import "server-only";

import { google } from "googleapis";
import { getGoogleAuthClient } from "./auth-client";

function getMeetClient() {
  const auth = getGoogleAuthClient([
    "https://www.googleapis.com/auth/meetings.space.readonly",
  ]);
  return google.meet({ version: "v2", auth });
}

interface MeetParticipant {
  email: string | null;
  displayName: string | null;
  earliestJoinTime: string | null;
  latestLeaveTime: string | null;
}

/**
 * Look up conference records by meeting code (from the Meet link).
 * Returns the most recent conference record for the meeting.
 */
export async function getConferenceRecord(
  meetCode: string
): Promise<string | null> {
  const meet = getMeetClient();

  // Meet code format: xxx-xxxx-xxx or full URL
  const code = meetCode
    .replace(/^https?:\/\/meet\.google\.com\//, "")
    .replace(/-/g, "-")
    .trim();

  try {
    const spacesRes = await meet.spaces.get({
      name: `spaces/${code}`,
    });

    if (!spacesRes.data.name) return null;

    // List conference records for this space
    const recordsRes = await meet.conferenceRecords.list({
      filter: `space.name="${spacesRes.data.name}"`,
    });

    const records = recordsRes.data.conferenceRecords || [];
    if (records.length === 0) return null;

    // Return the most recent conference record
    return records[records.length - 1].name || null;
  } catch (err) {
    console.error("Failed to get conference record:", err);
    return null;
  }
}

/**
 * Get participants from a conference record with their join/leave times.
 */
export async function getMeetParticipants(
  conferenceRecordName: string
): Promise<MeetParticipant[]> {
  const meet = getMeetClient();

  const participants: MeetParticipant[] = [];
  let pageToken: string | undefined;

  do {
    const res = await meet.conferenceRecords.participants.list({
      parent: conferenceRecordName,
      pageToken,
    });

    for (const participant of res.data.participants || []) {
      // Get participant sessions for join/leave times
      let earliestJoin: string | null = null;
      let latestLeave: string | null = null;

      if (participant.name) {
        try {
          const sessionsRes = await meet.conferenceRecords.participants.participantSessions.list({
            parent: participant.name,
          });

          for (const session of sessionsRes.data.participantSessions || []) {
            if (session.startTime && (!earliestJoin || session.startTime < earliestJoin)) {
              earliestJoin = session.startTime;
            }
            if (session.endTime && (!latestLeave || session.endTime > latestLeave)) {
              latestLeave = session.endTime;
            }
          }
        } catch {
          // Participant sessions might not be available
        }
      }

      // Extract email from signedinUser or anonymousUser
      const signedinUser = participant.signedinUser;
      const email = signedinUser?.user
        ? null // user ID, not email — will need to resolve
        : null;
      const displayName = signedinUser?.displayName || participant.anonymousUser?.displayName || null;

      participants.push({
        email,
        displayName,
        earliestJoinTime: earliestJoin,
        latestLeaveTime: latestLeave,
      });
    }

    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  return participants;
}

/**
 * Get Meet participants with email resolution via Admin SDK.
 * Matches participants to enrolled students by email.
 */
export async function getMeetAttendance(
  meetLink: string,
  sessionStartTime: string,
  sessionEndTime: string,
  enrolledEmails: { userId: string; email: string }[]
): Promise<{
  userId: string;
  email: string;
  status: "present" | "late" | "absent";
  joinedAt: string | null;
  leftAt: string | null;
  durationMinutes: number;
}[]> {
  // Extract meet code from link
  const meetCode = meetLink
    .replace(/^https?:\/\/meet\.google\.com\//, "")
    .trim();

  const conferenceRecordName = await getConferenceRecord(meetCode);

  // Build result: all enrolled students start as absent
  const result = enrolledEmails.map((student) => ({
    userId: student.userId,
    email: student.email,
    status: "absent" as "present" | "late" | "absent",
    joinedAt: null as string | null,
    leftAt: null as string | null,
    durationMinutes: 0,
  }));

  if (!conferenceRecordName) {
    return result;
  }

  const participants = await getMeetParticipants(conferenceRecordName);

  // Calculate session duration for late threshold
  const sessionStart = new Date(sessionStartTime);
  const sessionEnd = new Date(sessionEndTime);
  const sessionDuration = (sessionEnd.getTime() - sessionStart.getTime()) / 60000;
  const lateThresholdMs = 10 * 60 * 1000; // 10 minutes after start

  // Try matching participants to enrolled students by display name or email
  // Since Meet API returns user IDs (not emails), we match by displayName
  for (const participant of participants) {
    if (!participant.displayName) continue;

    // Find matching student by display name (case-insensitive)
    const normalizedName = participant.displayName.toLowerCase().trim();
    const matchIdx = result.findIndex(
      (r) =>
        r.email.toLowerCase().split("@")[0].includes(normalizedName) ||
        normalizedName.includes(r.email.toLowerCase().split("@")[0])
    );

    if (matchIdx === -1) continue;

    const joinTime = participant.earliestJoinTime
      ? new Date(participant.earliestJoinTime)
      : null;
    const leaveTime = participant.latestLeaveTime
      ? new Date(participant.latestLeaveTime)
      : null;

    const duration =
      joinTime && leaveTime
        ? Math.round((leaveTime.getTime() - joinTime.getTime()) / 60000)
        : 0;

    // Determine status
    let status: "present" | "late" | "absent" = "absent";
    if (joinTime) {
      if (duration >= sessionDuration * 0.5) {
        // Attended at least 50% of the session
        if (joinTime.getTime() - sessionStart.getTime() > lateThresholdMs) {
          status = "late";
        } else {
          status = "present";
        }
      } else if (duration > 0) {
        status = "late"; // Attended but less than 50%
      }
    }

    result[matchIdx] = {
      ...result[matchIdx],
      status,
      joinedAt: participant.earliestJoinTime,
      leftAt: participant.latestLeaveTime,
      durationMinutes: duration,
    };
  }

  return result;
}
