import type { Timestamp } from "firebase/firestore";

export type CertificateStatus = "generated" | "issued" | "revoked";

export interface Certificate {
  id: string; // e.g., "CERT-IFS-2026-XXXXX"
  userId: string;
  courseId: string;
  institutionId: string;
  enrollmentId: string;
  recipientName: string;
  courseName: string;
  institutionName: string;
  issueDate: Timestamp;
  expiryDate: Timestamp | null;
  googleDocId: string;
  pdfDriveFileId: string;
  pdfUrl: string;
  publicVerificationUrl: string;
  templateDocId: string;
  grade: string | null;
  finalScore: number | null;
  status: CertificateStatus;
  revokedReason: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
