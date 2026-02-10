import type { Timestamp } from "firebase/firestore";
import type { PaymentStatus } from "../enums/payment-status";

export interface WebhookEvent {
  eventType: string;
  receivedAt: Timestamp;
  payload: Record<string, unknown>;
}

export interface Payment {
  id: string;
  userId: string;
  courseId: string;
  institutionId: string;
  enrollmentId: string | null;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  razorpaySignature: string | null;
  amount: number; // In paise
  currency: string;
  status: PaymentStatus;
  refundId: string | null;
  refundAmount: number | null;
  refundReason: string | null;
  paymentMethod: string | null;
  bankName: string | null;
  receiptNumber: string;
  webhookEvents: WebhookEvent[];
  paidAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
