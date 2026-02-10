import "server-only";

import Razorpay from "razorpay";

let _instance: Razorpay | null = null;

/**
 * Get a lazily-initialized Razorpay server-side client.
 * Uses default env vars; per-institution keys are fetched from Firestore + Secret Manager.
 */
export function getRazorpayClient(): Razorpay {
  if (_instance) return _instance;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error(
      "Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET environment variables."
    );
  }

  _instance = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return _instance;
}
