export {
  createInstitutionSchema,
  updateInstitutionSchema,
  institutionBrandingSchema,
  institutionContactInfoSchema,
  type CreateInstitutionInput,
  type UpdateInstitutionInput,
} from "./institution.validator";

export {
  createCourseSchema,
  updateCourseSchema,
  createModuleSchema,
  createLessonSchema,
  videoCheckpointSchema,
  coursePricingSchema,
  type CreateCourseInput,
  type UpdateCourseInput,
  type CreateModuleInput,
  type CreateLessonInput,
} from "./course.validator";

export {
  createEnrollmentSchema,
  updateVideoProgressSchema,
  recordCheckpointResponseSchema,
  type CreateEnrollmentInput,
  type UpdateVideoProgressInput,
  type RecordCheckpointResponseInput,
} from "./enrollment.validator";
