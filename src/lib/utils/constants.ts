export const APP_NAME = "GyanSetu";

export const DEFAULT_INSTITUTION_ID =
  process.env.NEXT_PUBLIC_DEFAULT_INSTITUTION_ID || "ifs";

export const SESSION_COOKIE_NAME =
  process.env.SESSION_COOKIE_NAME || "__session";

export const INSTITUTION_COOKIE_NAME = "__institution";

export const DEFAULT_ACCESS_DAYS = 90;

export const RAZORPAY_CURRENCY = "INR";

export const VIDEO_COMPLETION_THRESHOLD = 0.9; // 90% watched = complete

export const PROGRESS_SAVE_DEBOUNCE_MS = 10_000; // Save video progress every 10s
