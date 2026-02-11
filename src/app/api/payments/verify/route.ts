import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { verifyPaymentSignature } from "@/lib/razorpay/verify";
import { FieldValue } from "firebase-admin/firestore";

/**
 * POST /api/payments/verify
 * Client-side callback after Razorpay checkout completes.
 * Verifies the signature and updates the payment status.
 *
 * Body: { razorpayOrderId, razorpayPaymentId, razorpaySignature, paymentId }
 */
export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("__session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const body = await request.json();

    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, paymentId } = body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !paymentId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    // Verify signature
    const isValid = verifyPaymentSignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
      secret,
    });

    if (!isValid) {
      return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
    }

    const db = getAdminDb();
    const paymentRef = db.collection("payments").doc(paymentId);
    const paymentDoc = await paymentRef.get();

    if (!paymentDoc.exists) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const payment = paymentDoc.data()!;

    // Verify this payment belongs to the user
    if (payment.userId !== decoded.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Update payment with Razorpay details
    await paymentRef.update({
      razorpayPaymentId,
      razorpaySignature,
      status: "captured",
      paidAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Create enrollment
    const enrollmentRef = db.collection("enrollments").doc();
    await enrollmentRef.set({
      id: enrollmentRef.id,
      userId: decoded.uid,
      courseId: payment.courseId,
      institutionId: payment.institutionId,
      status: "active",
      paymentId,
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

    // Link enrollment to payment
    await paymentRef.update({ enrollmentId: enrollmentRef.id });

    // Increment enrollment count on the course
    await db.collection("courses").doc(payment.courseId).update({
      enrollmentCount: FieldValue.increment(1),
    });

    return NextResponse.json({
      status: "verified",
      enrollmentId: enrollmentRef.id,
    });
  } catch (err) {
    console.error("Payment verification failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
