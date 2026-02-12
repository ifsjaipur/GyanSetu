import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * GET /api/exams/:id/attempts
 * List attempts for an exam.
 * Students see their own; admins/instructors see all.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: examId } = await params;
    const sessionCookie = request.cookies.get("__session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const db = getAdminDb();

    let query = db.collection("examAttempts").where("examId", "==", examId);

    if (decoded.role === "student") {
      query = query.where("userId", "==", decoded.uid);
    }

    const snap = await query.orderBy("createdAt", "desc").get();
    const attempts = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ attempts });
  } catch (err) {
    console.error("GET /api/exams/:id/attempts error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/exams/:id/attempts
 * Start or submit an exam attempt.
 * action=start: Creates a new in_progress attempt
 * action=submit: Submits the attempt with answers
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: examId } = await params;
    const sessionCookie = request.cookies.get("__session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const db = getAdminDb();

    const examDoc = await db.collection("exams").doc(examId).get();
    if (!examDoc.exists) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    const exam = examDoc.data()!;
    if (exam.status !== "published") {
      return NextResponse.json({ error: "Exam is not available" }, { status: 400 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === "start") {
      // Check enrollment
      const enrollSnap = await db
        .collection("enrollments")
        .where("courseId", "==", exam.courseId)
        .where("userId", "==", decoded.uid)
        .where("status", "==", "active")
        .limit(1)
        .get();

      if (enrollSnap.empty) {
        return NextResponse.json({ error: "Not enrolled in this course" }, { status: 403 });
      }

      // Check max attempts
      const existingAttempts = await db
        .collection("examAttempts")
        .where("examId", "==", examId)
        .where("userId", "==", decoded.uid)
        .get();

      if (existingAttempts.size >= exam.maxAttempts) {
        return NextResponse.json({ error: "Maximum attempts reached" }, { status: 400 });
      }

      // Check for in-progress attempt
      const inProgress = existingAttempts.docs.find(
        (d) => d.data().status === "in_progress"
      );
      if (inProgress) {
        return NextResponse.json({
          attempt: { id: inProgress.id, ...inProgress.data() },
          message: "Existing attempt resumed",
        });
      }

      const attemptRef = db.collection("examAttempts").doc();
      const attemptData = {
        id: attemptRef.id,
        examId,
        courseId: exam.courseId,
        userId: decoded.uid,
        institutionId: exam.institutionId,
        attemptNumber: existingAttempts.size + 1,
        status: "in_progress" as const,
        score: null,
        maxScore: exam.manualConfig?.maxScore || 100,
        percentageScore: null,
        passed: null,
        submissionUrl: null,
        submissionText: null,
        evaluatorId: null,
        feedback: null,
        formResponseId: null,
        startedAt: FieldValue.serverTimestamp(),
        submittedAt: null,
        gradedAt: null,
        createdAt: FieldValue.serverTimestamp(),
      };

      await attemptRef.set(attemptData);

      return NextResponse.json(
        { attempt: { ...attemptData, startedAt: new Date().toISOString() } },
        { status: 201 }
      );
    }

    if (action === "submit") {
      const { attemptId, submissionText, submissionUrl } = body;
      if (!attemptId) {
        return NextResponse.json({ error: "attemptId is required" }, { status: 400 });
      }

      const attemptRef = db.collection("examAttempts").doc(attemptId);
      const attemptDoc = await attemptRef.get();

      if (!attemptDoc.exists) {
        return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
      }

      const attempt = attemptDoc.data()!;
      if (attempt.userId !== decoded.uid) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (attempt.status !== "in_progress") {
        return NextResponse.json({ error: "Attempt already submitted" }, { status: 400 });
      }

      const updates: Record<string, unknown> = {
        status: "submitted",
        submittedAt: FieldValue.serverTimestamp(),
      };
      if (submissionText) updates.submissionText = submissionText;
      if (submissionUrl) updates.submissionUrl = submissionUrl;

      await attemptRef.update(updates);

      return NextResponse.json({ success: true, status: "submitted" });
    }

    return NextResponse.json({ error: "Invalid action. Use 'start' or 'submit'" }, { status: 400 });
  } catch (err) {
    console.error("POST /api/exams/:id/attempts error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/exams/:id/attempts
 * Grade an attempt. Instructor/admin only.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params; // consume params
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
    const body = await request.json();
    const { attemptId, score, feedback } = body;

    if (!attemptId || score === undefined) {
      return NextResponse.json({ error: "attemptId and score are required" }, { status: 400 });
    }

    const attemptRef = db.collection("examAttempts").doc(attemptId);
    const attemptDoc = await attemptRef.get();

    if (!attemptDoc.exists) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    const attempt = attemptDoc.data()!;
    if (attempt.status !== "submitted") {
      return NextResponse.json({ error: "Attempt not in submitted state" }, { status: 400 });
    }

    // Fetch exam to get passing score
    const examDoc = await db.collection("exams").doc(attempt.examId).get();
    const exam = examDoc.data()!;

    const maxScore = attempt.maxScore || 100;
    const percentageScore = Math.round((score / maxScore) * 100);
    const passed = percentageScore >= exam.passingScore;

    await attemptRef.update({
      score,
      percentageScore,
      passed,
      status: "graded",
      evaluatorId: decoded.uid,
      feedback: feedback || null,
      gradedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      score,
      percentageScore,
      passed,
    });
  } catch (err) {
    console.error("PUT /api/exams/:id/attempts error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
