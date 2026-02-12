import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * GET /api/exams/:id
 * Get a single exam with attempt info for students.
 */
export async function GET(
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
    const db = getAdminDb();

    const examDoc = await db.collection("exams").doc(id).get();
    if (!examDoc.exists) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    const exam = { id: examDoc.id, ...examDoc.data() };

    // Students can only see published exams
    if (decoded.role === "student" && examDoc.data()!.status !== "published") {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    // For students, include their attempts
    if (decoded.role === "student") {
      const attemptsSnap = await db
        .collection("examAttempts")
        .where("examId", "==", id)
        .where("userId", "==", decoded.uid)
        .orderBy("attemptNumber", "asc")
        .get();

      const attempts = attemptsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      return NextResponse.json({ exam, attempts });
    }

    // For instructors/admins, include all attempts
    const attemptsSnap = await db
      .collection("examAttempts")
      .where("examId", "==", id)
      .orderBy("createdAt", "desc")
      .get();

    const attempts = attemptsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ exam, attempts });
  } catch (err) {
    console.error("GET /api/exams/:id error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/exams/:id
 * Update an exam. Admin or instructor only.
 */
export async function PUT(
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
    const allowedRoles = ["super_admin", "institution_admin", "instructor"];
    if (!allowedRoles.includes(decoded.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getAdminDb();
    const examRef = db.collection("exams").doc(id);
    const examDoc = await examRef.get();

    if (!examDoc.exists) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    const exam = examDoc.data()!;
    if (decoded.role !== "super_admin" && exam.institutionId !== decoded.institutionId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, passingScore, maxAttempts, timeLimitMinutes, isRequired, status, order, googleFormsConfig, manualConfig } = body;

    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (passingScore !== undefined) updates.passingScore = passingScore;
    if (maxAttempts !== undefined) updates.maxAttempts = maxAttempts;
    if (timeLimitMinutes !== undefined) updates.timeLimitMinutes = timeLimitMinutes;
    if (isRequired !== undefined) updates.isRequired = isRequired;
    if (status !== undefined) updates.status = status;
    if (order !== undefined) updates.order = order;
    if (googleFormsConfig !== undefined) updates.googleFormsConfig = googleFormsConfig;
    if (manualConfig !== undefined) updates.manualConfig = manualConfig;

    await examRef.update(updates);

    const updated = await examRef.get();
    return NextResponse.json({ exam: { id: updated.id, ...updated.data() } });
  } catch (err) {
    console.error("PUT /api/exams/:id error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/exams/:id
 * Delete an exam. Admin or instructor only.
 */
export async function DELETE(
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
    const allowedRoles = ["super_admin", "institution_admin", "instructor"];
    if (!allowedRoles.includes(decoded.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getAdminDb();
    const examRef = db.collection("exams").doc(id);
    const examDoc = await examRef.get();

    if (!examDoc.exists) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    const exam = examDoc.data()!;
    if (decoded.role !== "super_admin" && exam.institutionId !== decoded.institutionId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await examRef.delete();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/exams/:id error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
