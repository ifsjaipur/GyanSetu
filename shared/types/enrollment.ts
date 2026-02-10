import type { Timestamp } from "firebase/firestore";
import type { EnrollmentStatus } from "../enums/enrollment-status";

export interface EnrollmentProgress {
  completedLessons: number;
  totalLessons: number;
  completedModules: number;
  totalModules: number;
  percentComplete: number;
  lastAccessedAt: Timestamp | null;
  lastLessonId: string | null;
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  institutionId: string;
  status: EnrollmentStatus;
  paymentId: string | null;
  accessStartDate: Timestamp;
  accessEndDate: Timestamp | null;
  classroomEnrolled: boolean;
  classroomStudentId: string | null;
  progress: EnrollmentProgress;
  attendanceCount: number;
  totalSessions: number;
  certificateId: string | null;
  certificateEligible: boolean;
  enrolledAt: Timestamp;
  completedAt: Timestamp | null;
  expiredAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
