import * as functions from "firebase-functions/v1";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import { getClassroomClient } from "../lib/google-clients";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

/**
 * Triggered when a new enrollment document is created.
 *
 * 1. Fetches the course to get classroomCourseId
 * 2. Fetches the institution to get Google Workspace credentials
 * 3. Enrolls the student in Google Classroom
 * 4. Calculates accessEndDate for self-paced courses
 * 5. Updates the enrollment document
 */
export const onEnrollmentCreate = functions.region("asia-south1").firestore
  .document("enrollments/{enrollmentId}")
  .onCreate(async (snap) => {
    const enrollment = snap.data();
    const enrollmentId = snap.id;

    try {
      // Fetch course
      const courseDoc = await db
        .collection("courses")
        .doc(enrollment.courseId)
        .get();

      if (!courseDoc.exists) {
        console.error(`Course ${enrollment.courseId} not found for enrollment ${enrollmentId}`);
        return;
      }

      const course = courseDoc.data()!;

      // Calculate accessEndDate for self-paced courses
      if (course.type === "self_paced" && course.selfPacedConfig?.accessDurationDays) {
        const now = new Date();
        const endDate = new Date(
          now.getTime() +
            course.selfPacedConfig.accessDurationDays * 24 * 60 * 60 * 1000
        );

        await snap.ref.update({
          accessEndDate: endDate,
        });
      }

      // Count total lessons and modules for progress tracking
      const modulesSnap = await db
        .collection("courses")
        .doc(enrollment.courseId)
        .collection("modules")
        .where("isPublished", "==", true)
        .get();

      let totalLessons = 0;
      for (const moduleDoc of modulesSnap.docs) {
        const lessonsSnap = await db
          .collection("courses")
          .doc(enrollment.courseId)
          .collection("modules")
          .doc(moduleDoc.id)
          .collection("lessons")
          .where("isPublished", "==", true)
          .get();
        totalLessons += lessonsSnap.size;
      }

      await snap.ref.update({
        "progress.totalLessons": totalLessons,
        "progress.totalModules": modulesSnap.size,
      });

      // Attempt Google Classroom enrollment
      if (!course.classroomCourseId) {
        console.log(
          `Course ${enrollment.courseId} has no Classroom course. Skipping enrollment.`
        );
        return;
      }

      // Fetch institution for Google credentials
      const instDoc = await db
        .collection("institutions")
        .doc(enrollment.institutionId)
        .get();

      if (!instDoc.exists) {
        console.error(
          `Institution ${enrollment.institutionId} not found for enrollment ${enrollmentId}`
        );
        return;
      }

      const institution = instDoc.data()!;

      if (!institution.googleWorkspace?.serviceAccountKeyRef) {
        console.warn(
          `Institution ${enrollment.institutionId} has no service account configured. Skipping Classroom enrollment.`
        );
        return;
      }

      // Fetch user email
      const userDoc = await db.collection("users").doc(enrollment.userId).get();
      if (!userDoc.exists) {
        console.error(`User ${enrollment.userId} not found`);
        return;
      }

      const user = userDoc.data()!;

      // Get service account key from Secret Manager (or env for now)
      const serviceAccountKey =
        process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
        institution.googleWorkspace.serviceAccountKeyRef;

      const classroom = getClassroomClient(
        serviceAccountKey,
        institution.googleWorkspace.adminEmail
      );

      if (user.isExternal) {
        // External users: create invitation
        try {
          await classroom.invitations.create({
            requestBody: {
              courseId: course.classroomCourseId,
              userId: user.email,
              role: "STUDENT",
            },
          });
          console.log(
            `Classroom invitation sent to external user ${user.email} for course ${course.classroomCourseId}`
          );
        } catch (invErr) {
          console.warn(
            `Failed to create Classroom invitation for ${user.email}:`,
            invErr
          );
        }
      } else {
        // Domain users: direct enrollment
        try {
          await classroom.courses.students.create({
            courseId: course.classroomCourseId,
            requestBody: { userId: user.email },
          });
        } catch (enrollErr) {
          console.warn(
            `Failed to enroll ${user.email} in Classroom course ${course.classroomCourseId}:`,
            enrollErr
          );
        }
      }

      await snap.ref.update({
        classroomEnrolled: true,
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(
        `Enrollment ${enrollmentId}: User ${user.email} enrolled in Classroom course ${course.classroomCourseId}`
      );
    } catch (err) {
      console.error(`Error processing enrollment ${enrollmentId}:`, err);
    }
  });
