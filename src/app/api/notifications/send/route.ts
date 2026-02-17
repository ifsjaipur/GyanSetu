import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { sendPushNotification } from "@/lib/notifications/push";
import { sendWhatsAppMessage } from "@/lib/notifications/whatsapp";
import { getCallerContext } from "@/lib/auth/get-caller-context";

/**
 * POST /api/notifications/send
 * Send push + optional WhatsApp notifications. Instructor/Admin only.
 *
 * Body: {
 *   type: "session_reminder" | "assignment_due" | "class_update" | "announcement" | "custom",
 *   title: string,
 *   body: string,
 *   url?: string,
 *   courseId?: string,        // sends to all enrolled students
 *   userIds?: string[],       // or send to specific users
 *   channels?: ("push" | "whatsapp")[], // default: ["push"]
 * }
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

    const body = await request.json();
    const { type, title, body: messageBody, url, courseId, userIds, channels = ["push"] } = body;

    if (!title || !messageBody) {
      return NextResponse.json({ error: "title and body are required" }, { status: 400 });
    }

    const db = getAdminDb();
    const institutionId = caller.institutionId;

    // Resolve target user IDs
    let targetUserIds: string[] = userIds || [];

    if (courseId && !userIds?.length) {
      // Send to all enrolled students in the course
      const enrollSnap = await db
        .collection("enrollments")
        .where("courseId", "==", courseId)
        .where("status", "==", "active")
        .where("institutionId", "==", institutionId)
        .get();
      targetUserIds = enrollSnap.docs.map((d) => d.data().userId);
    }

    if (targetUserIds.length === 0) {
      return NextResponse.json({ error: "No target users" }, { status: 400 });
    }

    const results = { push: 0, whatsapp: 0, errors: 0 };

    // Send push notifications
    if (channels.includes("push")) {
      const pushSnap = await db
        .collection("pushSubscriptions")
        .where("userId", "in", targetUserIds.slice(0, 30)) // Firestore "in" limit
        .get();

      for (const doc of pushSnap.docs) {
        const subs = doc.data().subscriptions || [];
        for (const sub of subs) {
          try {
            await sendPushNotification(sub, { title, body: messageBody, url, tag: type });
            results.push++;
          } catch {
            results.errors++;
          }
        }
      }
    }

    // Send WhatsApp messages
    if (channels.includes("whatsapp")) {
      // Fetch phone numbers for target users
      const userDocs = await Promise.all(
        targetUserIds.slice(0, 50).map((uid) => db.collection("users").doc(uid).get())
      );

      for (const userDoc of userDocs) {
        if (!userDoc.exists) continue;
        const phone = userDoc.data()?.phone;
        if (!phone) continue;

        try {
          await sendWhatsAppMessage({
            to: phone,
            templateName: type === "session_reminder" ? "session_reminder" : "general_notification",
            parameters: [title, messageBody],
            institutionId,
          });
          results.whatsapp++;
        } catch {
          results.errors++;
        }
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error("Send notification error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
