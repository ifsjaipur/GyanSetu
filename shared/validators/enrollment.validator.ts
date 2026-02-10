import { z } from "zod/v4";

export const createEnrollmentSchema = z.object({
  userId: z.string().min(1),
  courseId: z.string().min(1),
});

export const updateEnrollmentProgressSchema = z.object({
  completedLessons: z.number().int().min(0),
  totalLessons: z.number().int().min(0),
  completedModules: z.number().int().min(0),
  totalModules: z.number().int().min(0),
  percentComplete: z.number().min(0).max(100),
  lastLessonId: z.string().nullable(),
});

export const updateVideoProgressSchema = z.object({
  currentPositionSeconds: z.number().min(0),
  totalDurationSeconds: z.number().min(0),
  watchedSeconds: z.number().min(0),
  watchedPercentage: z.number().min(0).max(100),
  isCompleted: z.boolean(),
  watchedSegments: z.array(
    z.object({
      start: z.number().min(0),
      end: z.number().min(0),
    })
  ),
});

export const recordCheckpointResponseSchema = z.object({
  checkpointId: z.string().min(1),
  selectedOptionId: z.string().nullable(),
  textAnswer: z.string().nullable(),
});

export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;
export type UpdateVideoProgressInput = z.infer<typeof updateVideoProgressSchema>;
export type RecordCheckpointResponseInput = z.infer<typeof recordCheckpointResponseSchema>;
