import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { updateVideoProgressSchema } from "@shared/validators/enrollment.validator";
import { z } from "zod/v4";
import { getCallerContext } from "@/lib/auth/get-caller-context";

const putBodySchema = updateVideoProgressSchema.extend({
  moduleId: z.string().min(1),
  courseId: z.string().min(1),
});

/**
 * GET /api/video-progress/:lessonId
 * Fetch video progress for the authenticated user + lesson.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const { lessonId } = await params;
    const caller = await getCallerContext(request.cookies.get("__session")?.value);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const db = getAdminDb();

    const docId = `${caller.uid}_${lessonId}`;
    const doc = await db.collection("videoProgress").doc(docId).get();

    if (!doc.exists) {
      return NextResponse.json({ progress: null });
    }

    return NextResponse.json({ progress: doc.data() });
  } catch (err) {
    console.error("GET /api/video-progress error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/video-progress/:lessonId
 * Upsert video progress for the authenticated user + lesson.
 */
export async function PUT(
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
    const parsed = putBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const db = getAdminDb();
    const docId = `${caller.uid}_${lessonId}`;
    const docRef = db.collection("videoProgress").doc(docId);
    const existing = await docRef.get();

    const institutionId = caller.institutionId;

    if (existing.exists) {
      await docRef.update({
        currentPositionSeconds: data.currentPositionSeconds,
        totalDurationSeconds: data.totalDurationSeconds,
        watchedSeconds: data.watchedSeconds,
        watchedPercentage: data.watchedPercentage,
        isCompleted: data.isCompleted,
        watchedSegments: data.watchedSegments,
        lastUpdatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      await docRef.set({
        id: docId,
        userId: caller.uid,
        courseId: data.courseId,
        moduleId: data.moduleId,
        lessonId,
        institutionId,
        currentPositionSeconds: data.currentPositionSeconds,
        totalDurationSeconds: data.totalDurationSeconds,
        watchedSeconds: data.watchedSeconds,
        watchedPercentage: data.watchedPercentage,
        isCompleted: data.isCompleted,
        checkpointResponses: {},
        watchedSegments: data.watchedSegments,
        createdAt: FieldValue.serverTimestamp(),
        lastUpdatedAt: FieldValue.serverTimestamp(),
      });
    }

    const updated = await docRef.get();
    return NextResponse.json({ progress: updated.data() });
  } catch (err) {
    console.error("PUT /api/video-progress error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
