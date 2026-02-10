import "server-only";

import { google, type Auth } from "googleapis";

/**
 * Creates a Google Auth client using service account with domain-wide delegation.
 * Used server-side only (API routes and Cloud Functions).
 */
export function getGoogleAuthClient(
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
