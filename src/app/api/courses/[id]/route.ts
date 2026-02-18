import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { updateCourseSchema } from "@shared/validators/course.validator";
import { getCallerContext } from "@/lib/auth/get-caller-context";

/**
 * GET /api/courses/:id
 * Get course details.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const caller = await getCallerContext(request.cookies.get("__session")?.value);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const db = getAdminDb();

    const courseDoc = await db.collection("courses").doc(id).get();
    if (!courseDoc.exists) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const course = courseDoc.data()!;

    // Allow access if course belongs to user's institution OR its mother institution
    let hasAccess = caller.role === "super_admin" || course.institutionId === caller.institutionId;
    if (!hasAccess) {
      const userInstDoc = await db.collection("institutions").doc(caller.institutionId).get();
      const parentId = userInstDoc.exists ? userInstDoc.data()?.parentInstitutionId : null;
      if (parentId && course.institutionId === parentId) {
        hasAccess = true;
      }
    }
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Students can only see published courses
    if (caller.role === "student" && course.status !== "published") {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Fetch modules with lessons
    const modulesSnap = await db
      .collection("courses")
      .doc(id)
      .collection("modules")
      .orderBy("order")
      .get();

    const modules = await Promise.all(
      modulesSnap.docs.map(async (moduleDoc) => {
        const lessonsSnap = await db
          .collection("courses")
          .doc(id)
          .collection("modules")
          .doc(moduleDoc.id)
          .collection("lessons")
          .orderBy("order")
          .get();

        return {
          id: moduleDoc.id,
          ...moduleDoc.data(),
          lessons: lessonsSnap.docs.map((l) => ({ id: l.id, ...l.data() })),
        };
      })
    );

    const response = NextResponse.json({
      id: courseDoc.id,
      ...course,
      modules,
    });
    response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
    return response;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/**
 * PUT /api/courses/:id
 * Update a course. Admin or assigned instructor.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const caller = await getCallerContext(request.cookies.get("__session")?.value);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const db = getAdminDb();

    const courseRef = db.collection("courses").doc(id);
    const courseDoc = await courseRef.get();
    if (!courseDoc.exists) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const course = courseDoc.data()!;

    // Permission check
    const isSuperAdmin = caller.role === "super_admin";
    const isInstitutionAdmin =
      caller.role === "institution_admin" && course.institutionId === caller.institutionId;
    const isAssignedInstructor =
      caller.role === "instructor" &&
      course.institutionId === caller.institutionId &&
      course.instructorIds?.includes(caller.uid);

    if (!isSuperAdmin && !isInstitutionAdmin && !isAssignedInstructor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    // Prevent instructors from removing themselves from the course
    if (isAssignedInstructor && body.instructorIds && !body.instructorIds.includes(caller.uid)) {
      return NextResponse.json(
        { error: "Cannot remove yourself from the course" },
        { status: 400 }
      );
    }
    const parsed = updateCourseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    await courseRef.update({
      ...parsed.data,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const updated = await courseRef.get();
    return NextResponse.json({ id: updated.id, ...updated.data() });
  } catch (err) {
    console.error("Update course failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/courses/:id
 * Soft delete (archive) a course. Admin only.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const caller = await getCallerContext(request.cookies.get("__session")?.value);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const allowedRoles = ["super_admin", "institution_admin"];
    if (!allowedRoles.includes(caller.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getAdminDb();
    const courseRef = db.collection("courses").doc(id);
    const courseDoc = await courseRef.get();

    if (!courseDoc.exists) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if (
      caller.role !== "super_admin" &&
      courseDoc.data()!.institutionId !== caller.institutionId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Soft delete — archive the course
    await courseRef.update({
      status: "archived",
      isVisible: false,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ status: "archived" });
  } catch (err) {
    console.error("Archive course failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
