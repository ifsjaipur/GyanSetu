import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCallerContext } from "@/lib/auth/get-caller-context";
import { getFormResponses } from "@/lib/google/forms";
import { FieldValue } from "firebase-admin/firestore";

/**
 * POST /api/exams/:id/sync-forms
 * Sync Google Forms responses and auto-grade submitted attempts.
 * Instructor/Admin only.
 *
 * For quizzes with auto-grading, Google Forms assigns scores.
 * This endpoint fetches responses and matches them to exam attempts
 * by respondent email.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: examId } = await params;
    const caller = await getCallerContext(request.cookies.get("__session")?.value);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const allowedRoles = ["super_admin", "institution_admin", "instructor"];
    if (!allowedRoles.includes(caller.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getAdminDb();

    // Fetch exam
    const examDoc = await db.collection("exams").doc(examId).get();
    if (!examDoc.exists) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    const exam = examDoc.data()!;
    if (exam.type !== "google_forms" || !exam.googleFormsConfig?.formId) {
      return NextResponse.json(
        { error: "This exam is not a Google Forms exam" },
        { status: 400 }
      );
    }

    // Fetch form responses
    const responses = await getFormResponses(
      exam.googleFormsConfig.formId
    );

    // Build email→userId map from users collection
    const usersSnap = await db
      .collection("users")
      .where("institutionId", "==", exam.institutionId)
      .get();

    const emailToUid: Record<string, string> = {};
    usersSnap.docs.forEach((doc) => {
      const data = doc.data();
      if (data.email) {
        emailToUid[data.email.toLowerCase()] = doc.id;
      }
    });

    // Fetch all submitted (ungraded) attempts for this exam
    const attemptsSnap = await db
      .collection("examAttempts")
      .where("examId", "==", examId)
      .where("status", "==", "submitted")
      .get();

    let gradedCount = 0;

    for (const response of responses) {
      const respondentEmail = response.respondentEmail?.toLowerCase();
      if (!respondentEmail) continue;

      const userId = emailToUid[respondentEmail];
      if (!userId) continue;

      // Check if there's a submitted attempt for this user
      const attempt = attemptsSnap.docs.find(
        (doc) => doc.data().userId === userId
      );
      if (!attempt) continue;

      // Calculate score from form response
      // Google Forms quiz responses include totalScore in the response
      let score = 0;
      let maxScore = exam.manualConfig?.maxScore || 100;

      if (response.totalScore !== undefined && response.totalScore !== null) {
        score = response.totalScore;
      }

      // Check individual question scores if available
      if (response.answers) {
        let totalPoints = 0;
        let earnedPoints = 0;
        for (const [, answer] of Object.entries(response.answers)) {
          const ans = answer as { grade?: { score?: number; maxScore?: number } };
          if (ans.grade) {
            earnedPoints += ans.grade.score || 0;
            totalPoints += ans.grade.maxScore || 0;
          }
        }
        if (totalPoints > 0) {
          maxScore = totalPoints;
          score = earnedPoints;
        }
      }

      const percentageScore = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
      const passed = percentageScore >= exam.passingScore;

      await attempt.ref.update({
        score,
        maxScore,
        percentageScore,
        passed,
        status: "graded",
        formResponseId: response.responseId || null,
        evaluatorId: "google_forms_auto",
        feedback: passed
          ? "Congratulations! You passed the assessment."
          : `You scored ${percentageScore}%. The passing score is ${exam.passingScore}%.`,
        gradedAt: FieldValue.serverTimestamp(),
      });

      gradedCount++;
    }

    return NextResponse.json({
      success: true,
      totalResponses: responses.length,
      gradedCount,
      message: `Synced ${responses.length} responses, graded ${gradedCount} attempts`,
    });
  } catch (err) {
    console.error("POST /api/exams/:id/sync-forms error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
