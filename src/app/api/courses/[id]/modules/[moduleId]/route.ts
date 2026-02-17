import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCallerContext } from "@/lib/auth/get-caller-context";
import { FieldValue } from "firebase-admin/firestore";
import { updateModuleSchema } from "@shared/validators/course.validator";

/**
 * GET /api/courses/:id/modules/:moduleId
 * Get a single module with all its lessons.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; moduleId: string }> }
) {
  try {
    const { id: courseId, moduleId } = await params;
    const caller = await getCallerContext(request.cookies.get("__session")?.value);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const db = getAdminDb();

    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const course = courseDoc.data()!;

    if (caller.role !== "super_admin" && course.institutionId !== caller.institutionId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const moduleRef = db
      .collection("courses")
      .doc(courseId)
      .collection("modules")
      .doc(moduleId);
    const moduleDoc = await moduleRef.get();

    if (!moduleDoc.exists) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    const modData = moduleDoc.data()!;
    const mod = { id: moduleDoc.id, ...modData };
    const isAdminOrInstructor = ["super_admin", "institution_admin", "instructor"].includes(caller.role);

    // Students can't see unpublished modules
    if (!isAdminOrInstructor && !modData.isPublished) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    // Get all lessons
    const lessonsSnap = await moduleRef
      .collection("lessons")
      .orderBy("order", "asc")
      .get();

    const lessons = lessonsSnap.docs
      .map((l) => ({ id: l.id, ...l.data() } as Record<string, unknown> & { id: string }))
      .filter((l) => isAdminOrInstructor || l.isPublished);

    return NextResponse.json({ module: { ...mod, lessons } });
  } catch (err) {
    console.error("GET module detail error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/courses/:id/modules/:moduleId
 * Update a module.
 *
 * Body: Partial<{ title, description, order, isPublished, unlockAfterModuleId }>
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; moduleId: string }> }
) {
  try {
    const { id: courseId, moduleId } = await params;
    const caller = await getCallerContext(request.cookies.get("__session")?.value);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const allowedRoles = ["super_admin", "institution_admin", "instructor"];
    if (!allowedRoles.includes(caller.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getAdminDb();
    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const course = courseDoc.data()!;
    if (caller.role !== "super_admin" && course.institutionId !== caller.institutionId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (caller.role === "instructor" && !course.instructorIds?.includes(caller.uid)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateModuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const moduleRef = db
      .collection("courses")
      .doc(courseId)
      .collection("modules")
      .doc(moduleId);

    const moduleDoc = await moduleRef.get();
    if (!moduleDoc.exists) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    await moduleRef.update({
      ...parsed.data,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const updated = await moduleRef.get();
    return NextResponse.json({ module: { id: updated.id, ...updated.data() } });
  } catch (err) {
    console.error("PUT module error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/courses/:id/modules/:moduleId
 * Delete a module and all its lessons (cascade).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; moduleId: string }> }
) {
  try {
    const { id: courseId, moduleId } = await params;
    const caller = await getCallerContext(request.cookies.get("__session")?.value);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const allowedRoles = ["super_admin", "institution_admin", "instructor"];
    if (!allowedRoles.includes(caller.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getAdminDb();
    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const course = courseDoc.data()!;
    if (caller.role !== "super_admin" && course.institutionId !== caller.institutionId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (caller.role === "instructor" && !course.instructorIds?.includes(caller.uid)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const moduleRef = db
      .collection("courses")
      .doc(courseId)
      .collection("modules")
      .doc(moduleId);

    const moduleDoc = await moduleRef.get();
    if (!moduleDoc.exists) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    // Cascade delete: delete all lessons in this module
    const lessonsSnap = await moduleRef.collection("lessons").get();

    const batch = db.batch();

    // Delete all lessons
    for (const lessonDoc of lessonsSnap.docs) {
      batch.delete(lessonDoc.ref);
    }

    // Delete the module
    batch.delete(moduleRef);

    // Remove from course.moduleOrder
    batch.update(db.collection("courses").doc(courseId), {
      moduleOrder: FieldValue.arrayRemove(moduleId),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE module error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
