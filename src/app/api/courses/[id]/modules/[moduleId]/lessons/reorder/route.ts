import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCallerContext } from "@/lib/auth/get-caller-context";
import { FieldValue } from "firebase-admin/firestore";
import { reorderSchema } from "@shared/validators/course.validator";

/**
 * PUT /api/courses/:id/modules/:moduleId/lessons/reorder
 * Reorder lessons within a module.
 *
 * Body: { orderedIds: string[] }
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

    const moduleRef = db
      .collection("courses")
      .doc(courseId)
      .collection("modules")
      .doc(moduleId);

    const moduleDoc = await moduleRef.get();
    if (!moduleDoc.exists) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { orderedIds } = parsed.data;

    // Batch update: set module.lessonOrder + update each lesson's order field
    const batch = db.batch();

    batch.update(moduleRef, {
      lessonOrder: orderedIds,
      updatedAt: FieldValue.serverTimestamp(),
    });

    orderedIds.forEach((lessonId, index) => {
      const lessonRef = moduleRef.collection("lessons").doc(lessonId);
      batch.update(lessonRef, {
        order: index,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();

    return NextResponse.json({ success: true, lessonOrder: orderedIds });
  } catch (err) {
    console.error("PUT lessons reorder error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
