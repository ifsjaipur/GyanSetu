import { google, type Auth } from "googleapis";

/**
 * Creates a Google Auth client using a service account with domain-wide delegation.
 * The service account impersonates the institution's admin user for API access.
 */
export function getAuthClient(
  serviceAccountKey: string,
  adminEmail: string,
  scopes: string[]
): Auth.GoogleAuth {
  const credentials = JSON.parse(serviceAccountKey);
  return new google.auth.GoogleAuth({
    credentials,
    scopes,
    clientOptions: {
      subject: adminEmail,
    },
  });
}

export function getClassroomClient(
  serviceAccountKey: string,
  adminEmail: string
) {
  const auth = getAuthClient(serviceAccountKey, adminEmail, [
    "https://www.googleapis.com/auth/classroom.courses",
    "https://www.googleapis.com/auth/classroom.rosters",
  ]);
  return google.classroom({ version: "v1", auth });
}

export function getCalendarClient(
  serviceAccountKey: string,
  adminEmail: string
) {
  const auth = getAuthClient(serviceAccountKey, adminEmail, [
    "https://www.googleapis.com/auth/calendar.events",
  ]);
  return google.calendar({ version: "v3", auth });
}

export function getDriveClient(
  serviceAccountKey: string,
  adminEmail: string
) {
  const auth = getAuthClient(serviceAccountKey, adminEmail, [
    "https://www.googleapis.com/auth/drive.file",
  ]);
  return google.drive({ version: "v3", auth });
}

export function getDocsClient(
  serviceAccountKey: string,
  adminEmail: string
) {
  const auth = getAuthClient(serviceAccountKey, adminEmail, [
    "https://www.googleapis.com/auth/documents",
  ]);
  return google.docs({ version: "v1", auth });
}

export function getAdminSDKClient(
  serviceAccountKey: string,
  adminEmail: string
) {
  const auth = getAuthClient(serviceAccountKey, adminEmail, [
    "https://www.googleapis.com/auth/admin.directory.user.readonly",
  ]);
  return google.admin({ version: "directory_v1", auth });
}
