import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * POST /api/cron/expire-access
 * Cron job to expire enrollments whose accessEndDate has passed.
 * Should be called daily (e.g., via Vercel Cron or external cron).
 *
 * Protected by CRON_SECRET — not accessible without the secret.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminDb();
    const now = new Date();

    // Find active enrollments with an accessEndDate that has passed
    const expiredSnap = await db
      .collection("enrollments")
      .where("status", "==", "active")
      .where("accessEndDate", "<=", now)
      .get();

    if (expiredSnap.empty) {
      return NextResponse.json({
        message: "No enrollments to expire",
        expired: 0,
      });
    }

    const batch = db.batch();
    const expiredIds: string[] = [];

    expiredSnap.docs.forEach((doc) => {
      batch.update(doc.ref, {
        status: "expired",
        expiredAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      expiredIds.push(doc.id);
    });

    await batch.commit();

    console.log(`Expired ${expiredIds.length} enrollments:`, expiredIds);

    return NextResponse.json({
      message: `Expired ${expiredIds.length} enrollments`,
      expired: expiredIds.length,
      enrollmentIds: expiredIds,
    });
  } catch (err) {
    console.error("Cron expire-access failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
