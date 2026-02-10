import type { Timestamp } from "firebase/firestore";
import type {
  CourseType,
  CourseStatus,
  LessonType,
  VideoSource,
  QuestionType,
  SkillLevel,
  ResourceType,
} from "../enums/course-types";

// ─── Course ──────────────────────────────────────────────

export interface CoursePricing {
  amount: number; // In smallest currency unit (paise for INR)
  currency: string;
  originalAmount: number | null;
  isFree: boolean;
}

export interface BootcampScheduleEntry {
  dayOfWeek: number; // 0=Sun, 1=Mon, ...
  startTime: string; // "18:00"
  endTime: string; // "19:30"
  meetLink: string | null;
  calendarEventId: string | null;
  topic: string;
}

export interface BootcampConfig {
  startDate: Timestamp;
  endDate: Timestamp;
  schedule: BootcampScheduleEntry[];
  maxStudents: number;
  minAttendancePercent: number;
  calendarEventIds: string[];
}

export interface InstructorLedConfig {
  startDate: Timestamp;
  endDate: Timestamp;
  schedule: string;
  liveSessionCount: number;
}

export interface SelfPacedConfig {
  accessDurationDays: number;
  estimatedHours: number;
}

export interface Course {
  id: string;
  institutionId: string;
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  thumbnailUrl: string;
  type: CourseType;
  pricing: CoursePricing;
  bootcampConfig: BootcampConfig | null;
  instructorLedConfig: InstructorLedConfig | null;
  selfPacedConfig: SelfPacedConfig | null;
  classroomCourseId: string | null;
  classroomInviteLink: string | null;
  instructorIds: string[];
  tags: string[];
  prerequisites: string[];
  skillLevel: SkillLevel;
  language: string;
  moduleOrder: string[];
  status: CourseStatus;
  isVisible: boolean;
  enrollmentCount: number;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Module ──────────────────────────────────────────────

export interface Module {
  id: string;
  courseId: string;
  title: string;
  description: string;
  order: number;
  lessonOrder: string[];
  isPublished: boolean;
  unlockAfterModuleId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Lesson ──────────────────────────────────────────────

export interface QuestionOption {
  id: string;
  text: string;
}

export interface CheckpointQuestion {
  type: QuestionType;
  questionText: string;
  options: QuestionOption[];
  correctOptionId: string | null;
  correctAnswer: string | null;
  explanation: string;
}

export interface VideoCheckpoint {
  id: string;
  timestampSeconds: number;
  question: CheckpointQuestion;
  isRequired: boolean;
}

export interface VideoConfig {
  videoUrl: string;
  videoDurationSeconds: number;
  videoSource: VideoSource;
  youtubeVideoId: string | null;
  driveFileId: string | null;
  gcsPath: string | null;
  checkpoints: VideoCheckpoint[];
  requireFullWatch: boolean;
}

export interface LessonResource {
  title: string;
  url: string;
  type: ResourceType;
  driveFileId: string | null;
}

export interface AssignmentConfig {
  classroomAssignmentId: string | null;
  instructions: string;
  dueDate: Timestamp | null;
  maxPoints: number;
}

export interface Lesson {
  id: string;
  moduleId: string;
  courseId: string;
  title: string;
  type: LessonType;
  order: number;
  videoConfig: VideoConfig | null;
  textContent: string | null;
  resources: LessonResource[];
  assignmentConfig: AssignmentConfig | null;
  isPublished: boolean;
  estimatedMinutes: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
