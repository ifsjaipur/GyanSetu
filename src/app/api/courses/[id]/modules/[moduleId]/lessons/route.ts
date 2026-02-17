import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCallerContext } from "@/lib/auth/get-caller-context";
import { FieldValue } from "firebase-admin/firestore";
import { createLessonSchema } from "@shared/validators/course.validator";

/**
 * GET /api/courses/:id/modules/:moduleId/lessons
 * List all lessons in a module.
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

    const isAdminOrInstructor = ["super_admin", "institution_admin", "instructor"].includes(caller.role);

    const lessonsSnap = await moduleRef
      .collection("lessons")
      .orderBy("order", "asc")
      .get();

    const lessons = lessonsSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as Record<string, unknown> & { id: string }))
      .filter((l) => isAdminOrInstructor || l.isPublished);

    return NextResponse.json({ lessons });
  } catch (err) {
    console.error("GET lessons error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/courses/:id/modules/:moduleId/lessons
 * Create a new lesson in a module.
 */
export async function POST(
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
    const parsed = createLessonSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const lessonRef = moduleRef.collection("lessons").doc();

    const lessonData = {
      id: lessonRef.id,
      moduleId,
      courseId,
      ...parsed.data,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Batch: create lesson + append to module.lessonOrder
    const batch = db.batch();
    batch.set(lessonRef, lessonData);
    batch.update(moduleRef, {
      lessonOrder: FieldValue.arrayUnion(lessonRef.id),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    return NextResponse.json({
      lesson: { ...lessonData, createdAt: new Date().toISOString() },
    });
  } catch (err) {
    console.error("POST lesson error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
