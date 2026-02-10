/**
 * Setup Admin User Script
 *
 * Usage: npx tsx scripts/setup-admin.ts
 *
 * Finds the first user in Firebase Auth, creates their Firestore doc,
 * and sets custom claims (super_admin + institutionId).
 */

import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local
const envPath = resolve(__dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx);
  let value = trimmed.slice(eqIdx + 1);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  process.env[key] = value;
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing Firebase Admin credentials in .env.local");
  process.exit(1);
}

const serviceAccount: ServiceAccount = { projectId, clientEmail, privateKey };
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);
const auth = getAuth(app);

async function setupAdmin() {
  console.log("Looking up Firebase Auth users...\n");

  const listResult = await auth.listUsers(10);

  if (listResult.users.length === 0) {
    console.error("No users found in Firebase Auth. Sign in first at http://localhost:3000/login");
    process.exit(1);
  }

  console.log("Found users:");
  listResult.users.forEach((user, i) => {
    console.log(`  ${i + 1}. ${user.email} (${user.uid})`);
  });

  // Use the first user as super_admin
  const adminUser = listResult.users[0];
  console.log(`\nSetting up ${adminUser.email} as super_admin...\n`);

  // Set custom claims
  await auth.setCustomUserClaims(adminUser.uid, {
    role: "super_admin",
    institutionId: "ifs",
  });
  console.log("  Done: Custom claims set (role: super_admin, institutionId: ifs)");

  // Create/update user document in Firestore
  const userDocRef = db.collection("users").doc(adminUser.uid);
  const existing = await userDocRef.get();

  const userData = {
    uid: adminUser.uid,
    email: adminUser.email || "",
    displayName: adminUser.displayName || "",
    photoUrl: adminUser.photoURL || null,
    phone: adminUser.phoneNumber || null,
    institutionId: "ifs",
    role: "super_admin",
    isExternal: false,
    consentGiven: true,
    consentGivenAt: FieldValue.serverTimestamp(),
    profileComplete: true,
    googleWorkspaceUserId: null,
    profile: {
      bio: null,
      dateOfBirth: null,
      enrollmentNumber: null,
      department: null,
    },
    preferences: {
      emailNotifications: true,
      language: "en",
    },
    isActive: true,
    lastLoginAt: FieldValue.serverTimestamp(),
    ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await userDocRef.set(userData, { merge: true });
  console.log("  Done: User document created in Firestore");

  console.log("\n========================================");
  console.log("Admin setup complete!");
  console.log(`  User: ${adminUser.email}`);
  console.log(`  Role: super_admin`);
  console.log(`  Institution: ifs`);
  console.log("");
  console.log("IMPORTANT: Sign out and sign back in");
  console.log("at http://localhost:3000/login to pick");
  console.log("up the new custom claims.");
  console.log("========================================");

  process.exit(0);
}

setupAdmin().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
