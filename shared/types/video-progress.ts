import type { Timestamp } from "firebase/firestore";

export interface CheckpointResponse {
  answeredAt: Timestamp;
  selectedOptionId: string | null;
  textAnswer: string | null;
  isCorrect: boolean;
}

export interface WatchedSegment {
  start: number;
  end: number;
}

export interface VideoProgress {
  id: string; // `${userId}_${lessonId}`
  userId: string;
  courseId: string;
  moduleId: string;
  lessonId: string;
  institutionId: string;
  currentPositionSeconds: number;
  totalDurationSeconds: number;
  watchedSeconds: number;
  watchedPercentage: number;
  isCompleted: boolean;
  checkpointResponses: Record<string, CheckpointResponse>;
  watchedSegments: WatchedSegment[];
  lastUpdatedAt: Timestamp;
  createdAt: Timestamp;
}
