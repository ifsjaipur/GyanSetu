export enum CourseType {
  BOOTCAMP = "bootcamp",
  INSTRUCTOR_LED = "instructor_led",
  SELF_PACED = "self_paced",
}

export enum CourseStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  ARCHIVED = "archived",
}

export enum LessonType {
  VIDEO = "video",
  TEXT = "text",
  QUIZ = "quiz",
  ASSIGNMENT = "assignment",
  RESOURCE = "resource",
}

export enum VideoSource {
  YOUTUBE = "youtube",
  DRIVE = "drive",
  GCS = "gcs",
}

export enum SkillLevel {
  BEGINNER = "beginner",
  INTERMEDIATE = "intermediate",
  ADVANCED = "advanced",
}

export enum QuestionType {
  MULTIPLE_CHOICE = "multiple_choice",
  TRUE_FALSE = "true_false",
  SHORT_ANSWER = "short_answer",
}

export enum ResourceType {
  PDF = "pdf",
  DOC = "doc",
  LINK = "link",
  DRIVE_FILE = "drive_file",
}
