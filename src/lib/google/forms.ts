import "server-only";

import { google, type forms_v1 } from "googleapis";
import { getGoogleAuthClient } from "./auth-client";

function getFormsClient(
  serviceAccountKey: string,
  adminEmail: string
): forms_v1.Forms {
  const auth = getGoogleAuthClient(serviceAccountKey, adminEmail, [
    "https://www.googleapis.com/auth/forms.responses.readonly",
  ]);
  return google.forms({ version: "v1", auth });
}

/**
 * Fetch all responses for a Google Form.
 */
export async function getFormResponses(
  serviceAccountKey: string,
  adminEmail: string,
  formId: string
): Promise<forms_v1.Schema$FormResponse[]> {
  const forms = getFormsClient(serviceAccountKey, adminEmail);
  const res = await forms.forms.responses.list({ formId });
  return res.data.responses || [];
}

/**
 * Fetch form structure (questions, correct answers for quizzes).
 */
export async function getFormDetails(
  serviceAccountKey: string,
  adminEmail: string,
  formId: string
): Promise<forms_v1.Schema$Form> {
  const forms = getFormsClient(serviceAccountKey, adminEmail);
  const res = await forms.forms.get({ formId });
  return res.data;
}
