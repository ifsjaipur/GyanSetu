/**
 * Fix enrollment counts on course documents
 * Usage: npx tsx scripts/fix-enrollment-counts.ts
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

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  } as ServiceAccount),
});
const db = getFirestore(app);

async function main() {
  console.log("Counting active enrollments per course...");

  const snap = await db.collection("enrollments").where("status", "==", "active").get();
  const counts: Record<string, number> = {};

  snap.docs.forEach((d) => {
    const courseId = d.data().courseId;
    counts[courseId] = (counts[courseId] || 0) + 1;
  });

  console.log("Enrollment counts:", counts);

  for (const [courseId, count] of Object.entries(counts)) {
    await db.collection("courses").doc(courseId).update({ enrollmentCount: count });
    console.log(`  ${courseId}: ${count}`);
  }

  console.log("Done!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
