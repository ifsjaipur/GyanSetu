import type { Timestamp } from "firebase/firestore";

export type AuditSeverity = "info" | "warning" | "critical";

export interface AuditLog {
  id: string;
  institutionId: string;
  userId: string;
  userEmail: string;
  userRole: string;
  action: string; // e.g., "enrollment.create", "course.update"
  resource: string; // e.g., "enrollment", "course"
  resourceId: string;
  details: Record<string, unknown>;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  severity: AuditSeverity;
  createdAt: Timestamp;
}
