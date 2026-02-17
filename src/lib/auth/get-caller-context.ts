import "server-only";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

export interface CallerContext {
  uid: string;
  email: string;
  role: string;
  institutionId: string;
}

/**
 * Verify session cookie and read caller's role/institutionId from Firestore.
 * Returns null if not authenticated (missing/invalid cookie).
 *
 * Always reads from Firestore — never relies on stale session cookie claims
 * for role or institutionId. Decoded claims are used only as fallback if the
 * user doc doesn't exist yet.
 */
export async function getCallerContext(
  sessionCookie: string | undefined
): Promise<CallerContext | null> {
  if (!sessionCookie) return null;

  const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, false);
  const db = getAdminDb();
  const userDoc = await db.collection("users").doc(decoded.uid).get();
  const userData = userDoc.data();

  return {
    uid: decoded.uid,
    email: decoded.email || "",
    role: userData?.role || decoded.role || "student",
    institutionId:
      userData?.institutionId ||
      decoded.institutionId ||
      process.env.NEXT_PUBLIC_DEFAULT_INSTITUTION_ID ||
      "ifs",
  };
}
