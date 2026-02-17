import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { writeAuditLog } from "@/lib/audit-log";

/**
 * POST /api/courses/:id/copy
 * Copy a course (with modules and lessons) to another institution.
 * Body: { targetInstitutionId }
 * Only super_admin or institution_admin of the source institution.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionCookie = request.cookies.get("__session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const allowedRoles = ["super_admin", "institution_admin"];
    if (!allowedRoles.includes(decoded.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getAdminDb();
    const body = await request.json();
    const { targetInstitutionId } = body;

    if (!targetInstitutionId) {
      return NextResponse.json(
        { error: "targetInstitutionId is required" },
        { status: 400 }
      );
    }

    // Fetch source course
    const courseDoc = await db.collection("courses").doc(id).get();
    if (!courseDoc.exists) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const course = courseDoc.data()!;

    // Permission check: must be admin of source institution or super_admin
    if (
      decoded.role === "institution_admin" &&
      course.institutionId !== decoded.institutionId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify target institution exists
    const targetInstDoc = await db.collection("institutions").doc(targetInstitutionId).get();
    if (!targetInstDoc.exists) {
      return NextResponse.json(
        { error: "Target institution not found" },
        { status: 404 }
      );
    }

    // Check slug uniqueness in target institution
    const existingSlug = await db
      .collection("courses")
      .where("institutionId", "==", targetInstitutionId)
      .where("slug", "==", course.slug)
      .limit(1)
      .get();

    const slug = existingSlug.empty
      ? course.slug
      : `${course.slug}-copy-${Date.now().toString(36)}`;

    // Create the new course document
    const newCourseRef = db.collection("courses").doc();
    const {
      id: _oldId,
      institutionId: _oldInstId,
      createdAt: _oldCreatedAt,
      updatedAt: _oldUpdatedAt,
      classroomCourseId: _oldClassroom,
      classroomInviteLink: _oldClassroomLink,
      enrollmentCount: _oldEnrollCount,
      ...courseFields
    } = course;

    const newCourseData = {
      ...courseFields,
      id: newCourseRef.id,
      institutionId: targetInstitutionId,
      slug,
      classroomCourseId: null,
      classroomInviteLink: null,
      enrollmentCount: 0,
      copiedFrom: { courseId: id, institutionId: course.institutionId },
      createdBy: decoded.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await newCourseRef.set(newCourseData);

    // Copy modules and their lessons
    const modulesSnap = await db
      .collection("courses")
      .doc(id)
      .collection("modules")
      .orderBy("order")
      .get();

    const newModuleOrder: string[] = [];

    for (const moduleDoc of modulesSnap.docs) {
      const moduleData = moduleDoc.data();
      const newModuleRef = newCourseRef.collection("modules").doc();
      const {
        id: _mId,
        courseId: _mCourseId,
        createdAt: _mCreatedAt,
        updatedAt: _mUpdatedAt,
        ...moduleFields
      } = moduleData;

      const newLessonOrder: string[] = [];

      // Copy lessons within this module
      const lessonsSnap = await db
        .collection("courses")
        .doc(id)
        .collection("modules")
        .doc(moduleDoc.id)
        .collection("lessons")
        .orderBy("order")
        .get();

      for (const lessonDoc of lessonsSnap.docs) {
        const lessonData = lessonDoc.data();
        const newLessonRef = newModuleRef.collection("lessons").doc();
        const {
          id: _lId,
          moduleId: _lModuleId,
          courseId: _lCourseId,
          createdAt: _lCreatedAt,
          updatedAt: _lUpdatedAt,
          ...lessonFields
        } = lessonData;

        await newLessonRef.set({
          ...lessonFields,
          id: newLessonRef.id,
          moduleId: newModuleRef.id,
          courseId: newCourseRef.id,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        newLessonOrder.push(newLessonRef.id);
      }

      await newModuleRef.set({
        ...moduleFields,
        id: newModuleRef.id,
        courseId: newCourseRef.id,
        lessonOrder: newLessonOrder,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      newModuleOrder.push(newModuleRef.id);
    }

    // Update the new course's moduleOrder
    if (newModuleOrder.length > 0) {
      await newCourseRef.update({ moduleOrder: newModuleOrder });
    }

    writeAuditLog(
      {
        institutionId: targetInstitutionId,
        userId: decoded.uid,
        userEmail: decoded.email || "",
        userRole: decoded.role,
        action: "course.copy",
        resource: "course",
        resourceId: newCourseRef.id,
        details: {
          sourceCourseId: id,
          sourceInstitutionId: course.institutionId,
          targetInstitutionId,
          title: course.title,
        },
      },
      request
    );

    return NextResponse.json(
      {
        id: newCourseRef.id,
        slug,
        title: course.title,
        institutionId: targetInstitutionId,
        copiedFrom: { courseId: id, institutionId: course.institutionId },
        modulesCount: modulesSnap.size,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Copy course failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
