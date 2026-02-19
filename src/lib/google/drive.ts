import "server-only";

import { google } from "googleapis";
import { getGoogleAuthClient } from "./auth-client";

export function getDriveClient() {
  const auth = getGoogleAuthClient([
    "https://www.googleapis.com/auth/drive.file",
  ]);
  return google.drive({ version: "v3", auth });
}

/**
 * Copy a Google Drive file (used for certificate template → new certificate).
 */
export async function copyDriveFile(
  sourceFileId: string,
  newName: string,
  destinationFolderId?: string
) {
  const drive = getDriveClient();

  const response = await drive.files.copy({
    fileId: sourceFileId,
    requestBody: {
      name: newName,
      parents: destinationFolderId ? [destinationFolderId] : undefined,
    },
  });

  return response.data;
}

/**
 * Export a Google Doc as PDF.
 */
export async function exportAsPdf(fileId: string) {
  const drive = getDriveClient();

  const response = await drive.files.export(
    { fileId, mimeType: "application/pdf" },
    { responseType: "arraybuffer" }
  );

  return response.data as ArrayBuffer;
}

/**
 * Upload a file to Google Drive.
 */
export async function uploadToDrive(params: {
  name: string;
  mimeType: string;
  content: Buffer;
  folderId?: string;
}) {
  const drive = getDriveClient();
  const { Readable } = await import("stream");

  const response = await drive.files.create({
    requestBody: {
      name: params.name,
      mimeType: params.mimeType,
      parents: params.folderId ? [params.folderId] : undefined,
    },
    media: {
      mimeType: params.mimeType,
      body: Readable.from(params.content),
    },
    fields: "id,webViewLink,webContentLink",
  });

  return response.data;
}

/**
 * Set a file to "anyone with the link can view".
 */
export async function setPublicViewAccess(fileId: string) {
  const drive = getDriveClient();

  await drive.permissions.create({
    fileId,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  });
}
