import type { Timestamp } from "firebase/firestore";

export type ExamType = "google_forms" | "classroom_assignment" | "manual";
export type ExamStatus = "draft" | "published" | "closed";
export type AttemptStatus = "in_progress" | "submitted" | "graded" | "failed";

export interface GoogleFormsConfig {
  formId: string;
  formUrl: string;
  responseUrl: string;
  spreadsheetId: string | null;
  autoGraded: boolean;
}

export interface ClassroomExamConfig {
  courseWorkId: string;
  classroomCourseId: string;
  maxPoints: number;
  dueDate: Timestamp | null;
}

export interface ManualExamConfig {
  instructions: string;
  rubric: string;
  maxScore: number;
  submissionType: "file_upload" | "text" | "link";
}

export interface Exam {
  id: string;
  courseId: string;
  institutionId: string;
  title: string;
  description: string;
  type: ExamType;
  googleFormsConfig: GoogleFormsConfig | null;
  classroomConfig: ClassroomExamConfig | null;
  manualConfig: ManualExamConfig | null;
  passingScore: number;
  maxAttempts: number;
  timeLimitMinutes: number | null;
  isRequired: boolean;
  moduleId: string | null;
  order: number;
  status: ExamStatus;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  courseId: string;
  userId: string;
  institutionId: string;
  attemptNumber: number;
  status: AttemptStatus;
  score: number | null;
  maxScore: number;
  percentageScore: number | null;
  passed: boolean | null;
  submissionUrl: string | null;
  submissionText: string | null;
  evaluatorId: string | null;
  feedback: string | null;
  formResponseId: string | null;
  startedAt: Timestamp;
  submittedAt: Timestamp | null;
  gradedAt: Timestamp | null;
  createdAt: Timestamp;
}
