/**
 * One-time script to set a user as super_admin.
 *
 * Usage:
 *   npx tsx scripts/set-admin-role.ts <email>
 *
 * Example:
 *   npx tsx scripts/set-admin-role.ts sachin@ifsjaipur.com
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account key.
 */

import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const auth = admin.auth();
const db = admin.firestore();

async function setAdminRole(email: string) {
  // Find user by email
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  const uid = user.uid;
  const role = "super_admin";

  // Get current user doc to find institutionId
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) {
    console.error(`User document not found in Firestore for ${uid}`);
    process.exit(1);
  }

  const userData = userDoc.data()!;
  const institutionId = userData.institutionId || "";

  // Update custom claims
  await auth.setCustomUserClaims(uid, {
    role,
    institutionId,
    activeInstitutionId: institutionId,
  });

  // Update Firestore user doc
  await db.collection("users").doc(uid).update({
    role,
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`\nDone! ${email} (${uid}) is now super_admin`);
  console.log(`Institution: ${institutionId}`);
  console.log(`\nIMPORTANT: The user must sign out and sign back in for claims to take effect.`);
}

const email = process.argv[2];
if (!email) {
  console.error("Usage: npx tsx scripts/set-admin-role.ts <email>");
  process.exit(1);
}

setAdminRole(email)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  });
