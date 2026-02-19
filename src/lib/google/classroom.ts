import "server-only";

import { google } from "googleapis";
import { getGoogleAuthClient } from "./auth-client";

export function getClassroomClient() {
  const auth = getGoogleAuthClient([
    "https://www.googleapis.com/auth/classroom.courses",
    "https://www.googleapis.com/auth/classroom.rosters",
  ]);
  return google.classroom({ version: "v1", auth });
}

/**
 * Create a Google Classroom course.
 */
export async function createClassroomCourse(
  courseName: string,
  section: string,
  ownerEmail: string
) {
  const classroom = getClassroomClient();
  const response = await classroom.courses.create({
    requestBody: {
      name: courseName,
      section,
      ownerId: ownerEmail,
      courseState: "ACTIVE",
    },
  });
  return response.data;
}

/**
 * Enroll a student in a Google Classroom course.
 * For domain users: direct enrollment.
 * For external users: creates an invitation instead.
 */
export async function enrollStudentInClassroom(
  classroomCourseId: string,
  studentEmail: string,
  isExternal: boolean
) {
  const classroom = getClassroomClient();

  if (isExternal) {
    // External users (Gmail) need an invitation
    const response = await classroom.invitations.create({
      requestBody: {
        courseId: classroomCourseId,
        userId: studentEmail,
        role: "STUDENT",
      },
    });
    return { type: "invitation" as const, data: response.data };
  }

  // Domain users can be directly enrolled
  const response = await classroom.courses.students.create({
    courseId: classroomCourseId,
    requestBody: {
      userId: studentEmail,
    },
  });
  return { type: "enrollment" as const, data: response.data };
}

/**
 * Remove a student from a Google Classroom course.
 */
export async function removeStudentFromClassroom(
  classroomCourseId: string,
  studentEmail: string
) {
  const classroom = getClassroomClient();
  await classroom.courses.students.delete({
    courseId: classroomCourseId,
    userId: studentEmail,
  });
}
