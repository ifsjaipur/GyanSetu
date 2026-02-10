/**
 * Cloud Functions for the Education Platform
 *
 * Exports are organized by trigger type:
 * - triggers/   : Firestore & Auth triggers
 * - scheduled/  : Cron / Pub-Sub scheduled functions
 * - callable/   : Client-callable functions
 * - http/       : Raw HTTP functions (e.g., webhook backup)
 */

// ─── Auth Triggers ───────────────────────────────────────
export { onUserCreate } from "./triggers/onUserCreate";

// ─── Firestore Triggers ──────────────────────────────────
export { onEnrollmentCreate } from "./triggers/onEnrollmentCreate";
// export { onPaymentUpdate } from "./triggers/onPaymentUpdate";

// ─── Scheduled Functions ─────────────────────────────────
// export { expireAccess } from "./scheduled/expireAccess";
// export { syncClassroomRoster } from "./scheduled/syncClassroomRoster";

// ─── Callable Functions ──────────────────────────────────
// export { generateCertificate } from "./callable/generateCertificate";
// export { createBootcampSession } from "./callable/createBootcampSession";

// ─── HTTP Functions ──────────────────────────────────────
// export { razorpayWebhook } from "./http/razorpayWebhook";
