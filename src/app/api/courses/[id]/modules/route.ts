import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCallerContext } from "@/lib/auth/get-caller-context";
import { FieldValue } from "firebase-admin/firestore";
import { createModuleSchema } from "@shared/validators/course.validator";

/**
 * GET /api/courses/:id/modules
 * List modules for a course, ordered by the course's moduleOrder array.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: courseId } = await params;
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

    // Students can only see published modules of published courses
    const isAdminOrInstructor = ["super_admin", "institution_admin", "instructor"].includes(caller.role);

    const modulesSnap = await db
      .collection("courses")
      .doc(courseId)
      .collection("modules")
      .orderBy("order", "asc")
      .get();

    const modules = await Promise.all(
      modulesSnap.docs.map(async (modDoc) => {
        const modData = modDoc.data();
        const mod = { id: modDoc.id, ...modData };

        // Skip unpublished modules for students
        if (!isAdminOrInstructor && !modData.isPublished) return null;

        // Get lesson count and basic info
        const lessonsSnap = await db
          .collection("courses")
          .doc(courseId)
          .collection("modules")
          .doc(modDoc.id)
          .collection("lessons")
          .orderBy("order", "asc")
          .get();

        const lessons = lessonsSnap.docs
          .map((l) => ({ id: l.id, ...l.data() } as Record<string, unknown> & { id: string }))
          .filter((l) => isAdminOrInstructor || l.isPublished);

        return {
          ...mod,
          lessonCount: lessons.length,
          lessons: lessons.map((l) => ({
            id: l.id,
            title: l.title,
            type: l.type,
            order: l.order,
            isPublished: l.isPublished,
            estimatedMinutes: l.estimatedMinutes,
          })),
        };
      })
    );

    // Filter out nulls (unpublished modules for students)
    const filteredModules = modules.filter(Boolean);

    // Reorder based on course.moduleOrder if available
    const moduleOrder: string[] = course.moduleOrder || [];
    if (moduleOrder.length > 0) {
      filteredModules.sort((a, b) => {
        const aIdx = moduleOrder.indexOf(a!.id);
        const bIdx = moduleOrder.indexOf(b!.id);
        if (aIdx === -1 && bIdx === -1) return 0;
        if (aIdx === -1) return 1;
        if (bIdx === -1) return -1;
        return aIdx - bIdx;
      });
    }

    return NextResponse.json({ modules: filteredModules });
  } catch (err) {
    console.error("GET modules error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/courses/:id/modules
 * Create a new module for a course.
 *
 * Body: { title, description, order, isPublished, unlockAfterModuleId }
 */
export async function POST(
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
    const parsed = createModuleSchema.safeParse(body);
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
      .doc();

    const moduleData = {
      id: moduleRef.id,
      courseId,
      ...parsed.data,
      lessonOrder: [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Batch: create module + append to course.moduleOrder
    const batch = db.batch();
    batch.set(moduleRef, moduleData);
    batch.update(db.collection("courses").doc(courseId), {
      moduleOrder: FieldValue.arrayUnion(moduleRef.id),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    return NextResponse.json({
      module: { ...moduleData, createdAt: new Date().toISOString() },
    });
  } catch (err) {
    console.error("POST module error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
