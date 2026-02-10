import "server-only";

import { google } from "googleapis";
import { getGoogleAuthClient } from "./auth-client";

export function getDocsClient(
  serviceAccountKey: string,
  adminEmail: string
) {
  const auth = getGoogleAuthClient(serviceAccountKey, adminEmail, [
    "https://www.googleapis.com/auth/documents",
  ]);
  return google.docs({ version: "v1", auth });
}

/**
 * Replace placeholder text in a Google Doc (for certificate generation).
 * Placeholders use the format {{PLACEHOLDER_NAME}}.
 */
export async function mergeDocTemplate(
  serviceAccountKey: string,
  adminEmail: string,
  docId: string,
  replacements: Record<string, string>
) {
  const docs = getDocsClient(serviceAccountKey, adminEmail);

  const requests = Object.entries(replacements).map(([placeholder, value]) => ({
    replaceAllText: {
      containsText: {
        text: `{{${placeholder}}}`,
        matchCase: true,
      },
      replaceText: value,
    },
  }));

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: { requests },
  });
}
