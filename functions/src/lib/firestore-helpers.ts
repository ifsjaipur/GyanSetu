import { getFirestore, FieldValue } from "firebase-admin/firestore";
import type { AuditSeverity } from "../../../shared/types/audit-log";

const db = getFirestore();

/**
 * Write an audit log entry. Called from Cloud Functions only.
 */
export async function writeAuditLog(params: {
  institutionId: string;
  userId: string;
  userEmail: string;
  userRole: string;
  action: string;
  resource: string;
  resourceId: string;
  details?: Record<string, unknown>;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  severity?: AuditSeverity;
}) {
  await db.collection("auditLogs").add({
    ...params,
    details: params.details ?? {},
    previousValue: params.previousValue ?? null,
    newValue: params.newValue ?? null,
    severity: params.severity ?? "info",
    ipAddress: null,
    userAgent: null,
    createdAt: FieldValue.serverTimestamp(),
  });
}
