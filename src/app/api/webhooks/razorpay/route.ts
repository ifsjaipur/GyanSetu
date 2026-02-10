import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyWebhookSignature } from "@/lib/razorpay/verify";
import { FieldValue } from "firebase-admin/firestore";

/**
 * POST /api/webhooks/razorpay
 * Razorpay webhook handler — payment.captured, payment.failed, refund.created.
 * No session auth — verifies via X-Razorpay-Signature header.
 */
export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("x-razorpay-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const rawBody = await request.text();
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      console.error("RAZORPAY_WEBHOOK_SECRET not set");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    // Verify webhook signature
    const isValid = verifyWebhookSignature({
      body: rawBody,
      signature,
      secret,
    });

    if (!isValid) {
      console.warn("Invalid Razorpay webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event as string;
    const db = getAdminDb();

    switch (eventType) {
      case "payment.captured": {
        const payment = event.payload.payment.entity;
        const orderId = payment.order_id;
        const razorpayPaymentId = payment.id;

        // Find payment by Razorpay order ID
        const paymentSnap = await db
          .collection("payments")
          .where("razorpayOrderId", "==", orderId)
          .limit(1)
          .get();

        if (paymentSnap.empty) {
          console.warn(`No payment found for order ${orderId}`);
          return NextResponse.json({ status: "ignored" });
        }

        const paymentDoc = paymentSnap.docs[0];
        const paymentData = paymentDoc.data();

        // Idempotency: check if already processed
        if (paymentData.status === "captured" && paymentData.enrollmentId) {
          return NextResponse.json({ status: "already_processed" });
        }

        // Update payment status
        await paymentDoc.ref.update({
          razorpayPaymentId,
          status: "captured",
          paymentMethod: payment.method || null,
          bankName: payment.bank || null,
          paidAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          webhookEvents: FieldValue.arrayUnion({
            eventType,
            receivedAt: new Date().toISOString(),
            payload: { id: payment.id, method: payment.method },
          }),
        });

        // Create enrollment if not already created by verify route
        if (!paymentData.enrollmentId) {
          const enrollmentRef = db.collection("enrollments").doc();
          await enrollmentRef.set({
            id: enrollmentRef.id,
            userId: paymentData.userId,
            courseId: paymentData.courseId,
            institutionId: paymentData.institutionId,
            status: "active",
            paymentId: paymentDoc.id,
            accessStartDate: FieldValue.serverTimestamp(),
            accessEndDate: null,
            classroomEnrolled: false,
            classroomStudentId: null,
            progress: {
              completedLessons: 0,
              totalLessons: 0,
              completedModules: 0,
              totalModules: 0,
              percentComplete: 0,
              lastAccessedAt: null,
              lastLessonId: null,
            },
            attendanceCount: 0,
            totalSessions: 0,
            certificateId: null,
            certificateEligible: false,
            enrolledAt: FieldValue.serverTimestamp(),
            completedAt: null,
            expiredAt: null,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });

          await paymentDoc.ref.update({ enrollmentId: enrollmentRef.id });
        }
        break;
      }

      case "payment.failed": {
        const payment = event.payload.payment.entity;
        const orderId = payment.order_id;

        const paymentSnap = await db
          .collection("payments")
          .where("razorpayOrderId", "==", orderId)
          .limit(1)
          .get();

        if (!paymentSnap.empty) {
          await paymentSnap.docs[0].ref.update({
            status: "failed",
            updatedAt: FieldValue.serverTimestamp(),
            webhookEvents: FieldValue.arrayUnion({
              eventType,
              receivedAt: new Date().toISOString(),
              payload: { id: payment.id, error_code: payment.error_code },
            }),
          });
        }
        break;
      }

      case "refund.created": {
        const refund = event.payload.refund.entity;
        const razorpayPaymentId = refund.payment_id;

        const paymentSnap = await db
          .collection("payments")
          .where("razorpayPaymentId", "==", razorpayPaymentId)
          .limit(1)
          .get();

        if (!paymentSnap.empty) {
          await paymentSnap.docs[0].ref.update({
            status: "refunded",
            refundId: refund.id,
            refundAmount: refund.amount,
            updatedAt: FieldValue.serverTimestamp(),
            webhookEvents: FieldValue.arrayUnion({
              eventType,
              receivedAt: new Date().toISOString(),
              payload: { id: refund.id, amount: refund.amount },
            }),
          });

          // Update enrollment status
          const paymentData = paymentSnap.docs[0].data();
          if (paymentData.enrollmentId) {
            await db
              .collection("enrollments")
              .doc(paymentData.enrollmentId)
              .update({
                status: "refunded",
                updatedAt: FieldValue.serverTimestamp(),
              });
          }
        }
        break;
      }

      default:
        console.log(`Unhandled Razorpay event: ${eventType}`);
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("Webhook processing failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
