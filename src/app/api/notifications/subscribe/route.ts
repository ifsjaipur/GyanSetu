import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { getCallerContext } from "@/lib/auth/get-caller-context";

/**
 * POST /api/notifications/subscribe
 * Save push subscription for the authenticated user.
 */
export async function POST(request: NextRequest) {
  try {
    const caller = await getCallerContext(request.cookies.get("__session")?.value);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { subscription } = await request.json();

    if (!subscription?.endpoint) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    const db = getAdminDb();
    await db.collection("pushSubscriptions").doc(caller.uid).set(
      {
        userId: caller.uid,
        institutionId: caller.institutionId,
        subscriptions: FieldValue.arrayUnion(subscription),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Push subscribe error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/notifications/subscribe
 * Remove a push subscription.
 */
export async function DELETE(request: NextRequest) {
  try {
    const caller = await getCallerContext(request.cookies.get("__session")?.value);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { endpoint } = await request.json();

    if (!endpoint) {
      return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
    }

    const db = getAdminDb();
    const docRef = db.collection("pushSubscriptions").doc(caller.uid);
    const doc = await docRef.get();

    if (doc.exists) {
      const data = doc.data()!;
      const filtered = (data.subscriptions || []).filter(
        (s: { endpoint: string }) => s.endpoint !== endpoint
      );
      await docRef.update({ subscriptions: filtered, updatedAt: FieldValue.serverTimestamp() });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Push unsubscribe error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
