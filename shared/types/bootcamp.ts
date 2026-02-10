import type { Timestamp } from "firebase/firestore";

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface Attendance {
  id: string; // `${courseId}_${sessionDate}_${userId}`
  courseId: string;
  userId: string;
  institutionId: string;
  sessionDate: string; // "2026-02-15"
  calendarEventId: string;
  meetingCode: string | null;
  status: AttendanceStatus;
  joinedAt: Timestamp | null;
  leftAt: Timestamp | null;
  durationMinutes: number | null;
  markedBy: string;
  markedAt: Timestamp;
  notes: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
