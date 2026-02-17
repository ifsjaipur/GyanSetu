import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCallerContext } from "@/lib/auth/get-caller-context";
import { FieldValue } from "firebase-admin/firestore";

/**
 * GET /api/exams
 * List exams. Filtered by courseId (required) and optionally by status.
 * Students see only published exams; admins/instructors see all.
 */
export async function GET(request: NextRequest) {
  try {
    const caller = await getCallerContext(request.cookies.get("__session")?.value);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const db = getAdminDb();
    const { searchParams } = request.nextUrl;

    const courseId = searchParams.get("courseId");
    if (!courseId) {
      return NextResponse.json({ error: "courseId is required" }, { status: 400 });
    }

    let query = db
      .collection("exams")
      .where("courseId", "==", courseId);

    // Students only see published exams
    if (caller.role === "student") {
      query = query.where("status", "==", "published");
    }

    const snap = await query.orderBy("order", "asc").get();
    const exams = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // For students, also fetch their attempts
    if (caller.role === "student") {
      const attemptsSnap = await db
        .collection("examAttempts")
        .where("courseId", "==", courseId)
        .where("userId", "==", caller.uid)
        .get();

      const attempts = attemptsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      return NextResponse.json({ exams, attempts });
    }

    return NextResponse.json({ exams });
  } catch (err) {
    console.error("GET /api/exams error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/exams
 * Create a new exam. Admin or instructor only.
 */
export async function POST(request: NextRequest) {
  try {
    const caller = await getCallerContext(request.cookies.get("__session")?.value);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const allowedRoles = ["super_admin", "institution_admin", "instructor"];
    if (!allowedRoles.includes(caller.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getAdminDb();
    const body = await request.json();
    const { courseId, title, description, type, passingScore, maxAttempts, timeLimitMinutes, isRequired, moduleId, order, googleFormsConfig, manualConfig } = body;

    if (!courseId || !title || !type) {
      return NextResponse.json({ error: "courseId, title, and type are required" }, { status: 400 });
    }

    // Verify course exists and user has access
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

    const examRef = db.collection("exams").doc();
    const examData = {
      id: examRef.id,
      courseId,
      institutionId: course.institutionId,
      title,
      description: description || "",
      type,
      googleFormsConfig: type === "google_forms" ? googleFormsConfig || null : null,
      classroomConfig: null,
      manualConfig: type === "manual" ? manualConfig || { instructions: "", rubric: "", maxScore: 100, submissionType: "text" } : null,
      passingScore: passingScore || 50,
      maxAttempts: maxAttempts || 3,
      timeLimitMinutes: timeLimitMinutes || null,
      isRequired: isRequired ?? true,
      moduleId: moduleId || null,
      order: order || 0,
      status: "draft" as const,
      createdBy: caller.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await examRef.set(examData);

    return NextResponse.json({ exam: { ...examData, createdAt: new Date().toISOString() } }, { status: 201 });
  } catch (err) {
    console.error("POST /api/exams error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
