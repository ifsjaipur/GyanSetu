/**
 * Update Razorpay keys for IFS institution in Firestore
 *
 * Usage: npx tsx scripts/update-razorpay.ts
 */

import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
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

const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

if (!razorpayKeyId) {
  console.error("RAZORPAY_KEY_ID is empty in .env.local");
  process.exit(1);
}

const app = initializeApp({
  credential: cert({ projectId, clientEmail, privateKey } as ServiceAccount),
});
const db = getFirestore(app);

async function main() {
  console.log("Updating IFS institution Razorpay keys...");

  await db.collection("institutions").doc("ifs").update({
    "razorpay.keyId": razorpayKeyId,
    "razorpay.keySecretRef": razorpayKeySecret || "",
    "razorpay.webhookSecretRef": process.env.RAZORPAY_WEBHOOK_SECRET || "",
  });

  console.log("Done! Razorpay keys updated for IFS institution.");
  console.log(`  keyId: ${razorpayKeyId}`);
  console.log(`  keySecret: ${razorpayKeySecret ? "***" + razorpayKeySecret.slice(-4) : "(empty)"}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Update failed:", err);
  process.exit(1);
});
