import * as functions from "firebase-functions/v1";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import { getClassroomClient } from "../lib/google-clients";
import {
  getZoomCredentials,
  registerZoomParticipant,
} from "../lib/zoom-client";

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

      // Fetch institution for credentials
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

      // Fetch user
      const userDoc = await db.collection("users").doc(enrollment.userId).get();
      if (!userDoc.exists) {
        console.error(`User ${enrollment.userId} not found`);
        return;
      }

      const user = userDoc.data()!;

      // ─── Google Classroom enrollment ────────────────────
      if (course.classroomCourseId && process.env.GOOGLE_WORKSPACE_ADMIN_EMAIL) {
        const classroom = getClassroomClient();

        if (user.isExternal) {
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
      }

      // ─── Zoom auto-registration ─────────────────────────
      const zoomCreds = getZoomCredentials(institution.zoom);
      if (zoomCreds) {
        try {
          // Find upcoming Zoom sessions for this course
          const today = new Date().toISOString().split("T")[0];
          const sessionsSnap = await db
            .collection("courses")
            .doc(enrollment.courseId)
            .collection("sessions")
            .where("meetingPlatform", "==", "zoom")
            .where("sessionDate", ">=", today)
            .get();

          const nameParts = (user.displayName || user.email.split("@")[0]).split(" ");
          const firstName = nameParts[0] || "Student";
          const lastName = nameParts.slice(1).join(" ") || "User";

          let registered = 0;
          for (const sessionDoc of sessionsSnap.docs) {
            const session = sessionDoc.data();
            if (session.zoomMeetingId) {
              try {
                await registerZoomParticipant(
                  zoomCreds,
                  session.zoomMeetingId,
                  user.email,
                  firstName,
                  lastName
                );
                registered++;
              } catch (regErr) {
                console.warn(
                  `Failed to register ${user.email} for Zoom meeting ${session.zoomMeetingId}:`,
                  regErr
                );
              }
            }
          }

          if (registered > 0) {
            console.log(
              `Enrollment ${enrollmentId}: User ${user.email} registered in ${registered} upcoming Zoom meetings`
            );
          }
        } catch (zoomErr) {
          console.warn(`Zoom auto-registration failed for enrollment ${enrollmentId}:`, zoomErr);
        }
      }
    } catch (err) {
      console.error(`Error processing enrollment ${enrollmentId}:`, err);
    }
  });
