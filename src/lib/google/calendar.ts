import "server-only";

import { google } from "googleapis";
import { getGoogleAuthClient } from "./auth-client";

export function getCalendarClient(
  serviceAccountKey: string,
  adminEmail: string
) {
  const auth = getGoogleAuthClient(serviceAccountKey, adminEmail, [
    "https://www.googleapis.com/auth/calendar.events",
  ]);
  return google.calendar({ version: "v3", auth });
}

/**
 * Create a Calendar event with an auto-generated Google Meet link.
 */
export async function createMeetSession(
  serviceAccountKey: string,
  adminEmail: string,
  params: {
    summary: string;
    description: string;
    startTime: string; // ISO 8601
    endTime: string;
    timeZone: string;
    attendeeEmails: string[];
    requestId: string; // Unique ID for idempotency
  }
) {
  const calendar = getCalendarClient(serviceAccountKey, adminEmail);

  const event = await calendar.events.insert({
    calendarId: adminEmail,
    conferenceDataVersion: 1,
    requestBody: {
      summary: params.summary,
      description: params.description,
      start: {
        dateTime: params.startTime,
        timeZone: params.timeZone,
      },
      end: {
        dateTime: params.endTime,
        timeZone: params.timeZone,
      },
      attendees: params.attendeeEmails.map((email) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: params.requestId,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    },
  });

  const meetLink = event.data.conferenceData?.entryPoints?.find(
    (ep) => ep.entryPointType === "video"
  )?.uri;

  return {
    eventId: event.data.id!,
    meetLink: meetLink || null,
    htmlLink: event.data.htmlLink || null,
  };
}
