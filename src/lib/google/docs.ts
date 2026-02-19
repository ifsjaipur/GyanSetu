import "server-only";

import { google } from "googleapis";
import { getGoogleAuthClient } from "./auth-client";

export function getDocsClient() {
  const auth = getGoogleAuthClient([
    "https://www.googleapis.com/auth/documents",
  ]);
  return google.docs({ version: "v1", auth });
}

/**
 * Replace placeholder text in a Google Doc (for certificate generation).
 * Placeholders use the format {{PLACEHOLDER_NAME}}.
 */
export async function mergeDocTemplate(
  docId: string,
  replacements: Record<string, string>
) {
  const docs = getDocsClient();

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
