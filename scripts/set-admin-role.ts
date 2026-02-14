/**
 * One-time script to set a user as super_admin.
 *
 * Usage:
 *   npx tsx scripts/set-admin-role.ts <email>
 *
 * Example:
 *   npx tsx scripts/set-admin-role.ts sachin@ifsjaipur.com
 *
 * Reads Firebase credentials from .env.local.
 */

import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local from project root
config({ path: resolve(__dirname, "..", ".env.local") });

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing Firebase Admin credentials in .env.local");
  console.error("Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY");
  process.exit(1);
}

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
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
