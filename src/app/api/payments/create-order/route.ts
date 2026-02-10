import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { getRazorpayClient } from "@/lib/razorpay/client";
import { FieldValue } from "firebase-admin/firestore";

/**
 * POST /api/payments/create-order
 * Create a Razorpay order for course enrollment.
 * Body: { courseId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("__session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const { courseId } = await request.json();

    if (!courseId) {
      return NextResponse.json({ error: "courseId is required" }, { status: 400 });
    }

    const db = getAdminDb();

    // Fetch course
    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const course = courseDoc.data()!;

    // Check institution match
    if (course.institutionId !== decoded.institutionId) {
      return NextResponse.json({ error: "Course not in your institution" }, { status: 403 });
    }

    // Check if already enrolled
    const existingEnrollment = await db
      .collection("enrollments")
      .where("userId", "==", decoded.uid)
      .where("courseId", "==", courseId)
      .where("status", "in", ["active", "pending_payment"])
      .limit(1)
      .get();

    if (!existingEnrollment.empty) {
      return NextResponse.json(
        { error: "You are already enrolled in this course" },
        { status: 409 }
      );
    }

    // Free course — create enrollment directly
    if (course.pricing?.isFree) {
      const enrollmentRef = db.collection("enrollments").doc();
      await enrollmentRef.set({
        id: enrollmentRef.id,
        userId: decoded.uid,
        courseId,
        institutionId: course.institutionId,
        status: "active",
        paymentId: null,
        accessStartDate: FieldValue.serverTimestamp(),
        accessEndDate: null, // Calculated in Cloud Function if self_paced
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

      return NextResponse.json({
        free: true,
        enrollmentId: enrollmentRef.id,
      });
    }

    // Paid course — create Razorpay order
    const razorpay = getRazorpayClient();
    const receiptNumber = `rcpt_${Date.now()}_${decoded.uid.slice(0, 6)}`;

    const order = await razorpay.orders.create({
      amount: course.pricing.amount,
      currency: course.pricing.currency || "INR",
      receipt: receiptNumber,
      notes: {
        courseId,
        userId: decoded.uid,
        institutionId: course.institutionId,
      },
    });

    // Create payment record
    const paymentRef = db.collection("payments").doc();
    await paymentRef.set({
      id: paymentRef.id,
      userId: decoded.uid,
      courseId,
      institutionId: course.institutionId,
      enrollmentId: null,
      razorpayOrderId: order.id,
      razorpayPaymentId: null,
      razorpaySignature: null,
      amount: course.pricing.amount,
      currency: course.pricing.currency || "INR",
      status: "created",
      refundId: null,
      refundAmount: null,
      refundReason: null,
      paymentMethod: null,
      bankName: null,
      receiptNumber,
      webhookEvents: [],
      paidAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      free: false,
      orderId: order.id,
      paymentId: paymentRef.id,
      amount: course.pricing.amount,
      currency: course.pricing.currency || "INR",
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("Create order failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
