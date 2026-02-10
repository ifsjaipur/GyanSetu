import { z } from "zod/v4";

const courseTypeEnum = z.enum(["bootcamp", "instructor_led", "self_paced"]);
const courseStatusEnum = z.enum(["draft", "published", "archived"]);
const skillLevelEnum = z.enum(["beginner", "intermediate", "advanced"]);
const videoSourceEnum = z.enum(["youtube", "drive", "gcs"]);
const lessonTypeEnum = z.enum(["video", "text", "quiz", "assignment", "resource"]);
const questionTypeEnum = z.enum(["multiple_choice", "true_false", "short_answer"]);

export const coursePricingSchema = z.object({
  amount: z.number().int().min(0),
  currency: z.string().length(3), // ISO 4217
  originalAmount: z.number().int().min(0).nullable(),
  isFree: z.boolean(),
});

export const createCourseSchema = z.object({
  title: z.string().min(3).max(200),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  description: z.string().min(10).max(5000),
  shortDescription: z.string().min(10).max(300),
  thumbnailUrl: z.string().optional(),
  type: courseTypeEnum,
  pricing: coursePricingSchema,
  skillLevel: skillLevelEnum,
  language: z.string().min(2).max(5),
  tags: z.array(z.string().max(50)).max(20),
  prerequisites: z.array(z.string()).max(10),
  instructorIds: z.array(z.string()).min(1),
});

export const updateCourseSchema = createCourseSchema.partial();

export const createModuleSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(1000),
  order: z.number().int().min(0),
  isPublished: z.boolean(),
  unlockAfterModuleId: z.string().nullable(),
});

export const videoCheckpointSchema = z.object({
  id: z.string(),
  timestampSeconds: z.number().min(0),
  question: z.object({
    type: questionTypeEnum,
    questionText: z.string().min(5).max(500),
    options: z.array(
      z.object({
        id: z.string(),
        text: z.string().min(1).max(200),
      })
    ),
    correctOptionId: z.string().nullable(),
    correctAnswer: z.string().nullable(),
    explanation: z.string().max(500),
  }),
  isRequired: z.boolean(),
});

export const createLessonSchema = z.object({
  title: z.string().min(2).max(200),
  type: lessonTypeEnum,
  order: z.number().int().min(0),
  videoConfig: z
    .object({
      videoUrl: z.string().min(1),
      videoDurationSeconds: z.number().min(0),
      videoSource: videoSourceEnum,
      youtubeVideoId: z.string().nullable(),
      driveFileId: z.string().nullable(),
      gcsPath: z.string().nullable(),
      checkpoints: z.array(videoCheckpointSchema),
      requireFullWatch: z.boolean(),
    })
    .nullable(),
  textContent: z.string().nullable(),
  resources: z.array(
    z.object({
      title: z.string().min(1).max(200),
      url: z.string(),
      type: z.enum(["pdf", "doc", "link", "drive_file"]),
      driveFileId: z.string().nullable(),
    })
  ),
  assignmentConfig: z
    .object({
      classroomAssignmentId: z.string().nullable(),
      instructions: z.string().min(10),
      maxPoints: z.number().int().min(0),
    })
    .nullable(),
  isPublished: z.boolean(),
  estimatedMinutes: z.number().int().min(1),
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
export type CreateModuleInput = z.infer<typeof createModuleSchema>;
export type CreateLessonInput = z.infer<typeof createLessonSchema>;
