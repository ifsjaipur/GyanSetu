import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCallerContext } from "@/lib/auth/get-caller-context";
import { FieldValue } from "firebase-admin/firestore";
import { reorderSchema } from "@shared/validators/course.validator";

/**
 * PUT /api/courses/:id/modules/reorder
 * Reorder modules by providing an ordered array of module IDs.
 *
 * Body: { orderedIds: string[] }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: courseId } = await params;
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
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { orderedIds } = parsed.data;

    // Batch update: set course.moduleOrder + update each module's order field
    const batch = db.batch();

    batch.update(db.collection("courses").doc(courseId), {
      moduleOrder: orderedIds,
      updatedAt: FieldValue.serverTimestamp(),
    });

    orderedIds.forEach((moduleId, index) => {
      const moduleRef = db
        .collection("courses")
        .doc(courseId)
        .collection("modules")
        .doc(moduleId);
      batch.update(moduleRef, {
        order: index,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();

    return NextResponse.json({ success: true, moduleOrder: orderedIds });
  } catch (err) {
    console.error("PUT modules reorder error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
