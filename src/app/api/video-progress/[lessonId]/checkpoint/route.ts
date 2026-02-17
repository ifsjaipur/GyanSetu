import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { recordCheckpointResponseSchema } from "@shared/validators/enrollment.validator";
import { getCallerContext } from "@/lib/auth/get-caller-context";

/**
 * POST /api/video-progress/:lessonId/checkpoint
 * Record a checkpoint response for the authenticated user + lesson.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const { lessonId } = await params;
    const caller = await getCallerContext(request.cookies.get("__session")?.value);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const body = await request.json();
    const parsed = recordCheckpointResponseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { checkpointId, selectedOptionId, textAnswer } = parsed.data;
    const db = getAdminDb();
    const docId = `${caller.uid}_${lessonId}`;
    const docRef = db.collection("videoProgress").doc(docId);
    const existing = await docRef.get();

    const responseData = {
      answeredAt: FieldValue.serverTimestamp(),
      selectedOptionId: selectedOptionId || null,
      textAnswer: textAnswer || null,
      isCorrect: body.isCorrect ?? false,
    };

    if (existing.exists) {
      await docRef.update({
        [`checkpointResponses.${checkpointId}`]: responseData,
        lastUpdatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      // Create skeleton doc
      const institutionId = caller.institutionId;

      await docRef.set({
        id: docId,
        userId: caller.uid,
        courseId: body.courseId || "",
        moduleId: body.moduleId || "",
        lessonId,
        institutionId,
        currentPositionSeconds: 0,
        totalDurationSeconds: 0,
        watchedSeconds: 0,
        watchedPercentage: 0,
        isCompleted: false,
        checkpointResponses: { [checkpointId]: responseData },
        watchedSegments: [],
        createdAt: FieldValue.serverTimestamp(),
        lastUpdatedAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/video-progress/checkpoint error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
