import "server-only";

import { createHmac } from "crypto";

/**
 * Verify Razorpay payment signature.
 * Used after client-side checkout to confirm the payment is genuine.
 */
export function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
  secret: string;
}): boolean {
  const body = `${params.orderId}|${params.paymentId}`;
  const expectedSignature = createHmac("sha256", params.secret)
    .update(body)
    .digest("hex");
  return expectedSignature === params.signature;
}

/**
 * Verify Razorpay webhook signature.
 * The raw body and the X-Razorpay-Signature header are compared.
 */
export function verifyWebhookSignature(params: {
  body: string;
  signature: string;
  secret: string;
}): boolean {
  const expectedSignature = createHmac("sha256", params.secret)
    .update(params.body)
    .digest("hex");
  return expectedSignature === params.signature;
}
