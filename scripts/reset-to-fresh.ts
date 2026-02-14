/**
 * Reset Firebase to a fresh state for testing initial setup.
 *
 * What this script does:
 *   1. Deletes ALL Firestore data (every document in every collection)
 *   2. Deletes ALL Firebase Auth users EXCEPT the super admin email
 *   3. Resets the super admin's custom claims to { role: "super_admin" }
 *   4. Does NOT create a Firestore user doc — the onUserCreate Cloud Function
 *      will handle that when the super admin next signs in (or you can run
 *      set-admin-role.ts after login to set the role).
 *
 * Usage:
 *   npx tsx scripts/reset-to-fresh.ts
 *   npx tsx scripts/reset-to-fresh.ts --dry-run
 *
 * Reads Firebase credentials from .env.local (same as the Next.js app).
 */

import * as admin from "firebase-admin";
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

const SUPER_ADMIN_EMAIL = "sachin@ifsjaipur.com";
const DRY_RUN = process.argv.includes("--dry-run");

// All top-level Firestore collections in the project
const TOP_LEVEL_COLLECTIONS = [
  "institutions",
  "users",
  "courses",
  "enrollments",
  "payments",
  "certificates",
  "exams",
  "examAttempts",
  "videoProgress",
  "attendance",
  "pushSubscriptions",
  "auditLogs",
  "zoomMeetings",
];

// Known subcollections (parent collection → subcollection names)
const SUBCOLLECTIONS: Record<string, string[]> = {
  users: ["memberships"],
  courses: ["modules", "sessions"],
  zoomMeetings: ["participants"],
};

// modules have a nested subcollection: lessons
const MODULE_SUBCOLLECTIONS = ["lessons"];

async function deleteCollection(collectionPath: string): Promise<number> {
  const collectionRef = db.collection(collectionPath);
  let totalDeleted = 0;

  while (true) {
    const snapshot = await collectionRef.limit(500).get();
    if (snapshot.empty) break;

    const batch = db.batch();
    for (const doc of snapshot.docs) {
      if (!DRY_RUN) {
        batch.delete(doc.ref);
      }
    }

    if (!DRY_RUN) {
      await batch.commit();
    }

    totalDeleted += snapshot.size;
    console.log(`  ${DRY_RUN ? "[DRY RUN] Would delete" : "Deleted"} ${snapshot.size} docs from ${collectionPath} (total: ${totalDeleted})`);

    if (snapshot.size < 500) break;
  }

  return totalDeleted;
}

async function deleteSubcollections(parentCollection: string, subcollectionNames: string[]): Promise<number> {
  let total = 0;

  const parentSnap = await db.collection(parentCollection).get();
  for (const parentDoc of parentSnap.docs) {
    for (const subName of subcollectionNames) {
      const subPath = `${parentCollection}/${parentDoc.id}/${subName}`;
      const subSnap = await db.collection(subPath).limit(1).get();
      if (!subSnap.empty) {
        // For courses/modules, also delete lessons subcollection
        if (parentCollection === "courses" && subName === "modules") {
          const modulesSnap = await db.collection(subPath).get();
          for (const moduleDoc of modulesSnap.docs) {
            for (const lessonSub of MODULE_SUBCOLLECTIONS) {
              const lessonPath = `${subPath}/${moduleDoc.id}/${lessonSub}`;
              total += await deleteCollection(lessonPath);
            }
          }
        }
        total += await deleteCollection(subPath);
      }
    }
  }

  return total;
}

async function deleteAllFirestoreData(): Promise<number> {
  let grandTotal = 0;

  console.log("\n--- Deleting Firestore Data ---\n");

  // Step 1: Delete subcollections first (bottom-up)
  for (const [parent, subs] of Object.entries(SUBCOLLECTIONS)) {
    console.log(`Checking subcollections of ${parent}...`);
    grandTotal += await deleteSubcollections(parent, subs);
  }

  // Step 2: Delete top-level collections
  for (const collName of TOP_LEVEL_COLLECTIONS) {
    console.log(`Deleting collection: ${collName}`);
    grandTotal += await deleteCollection(collName);
  }

  return grandTotal;
}

async function deleteAllAuthUsers(): Promise<{ deleted: number; kept: string }> {
  console.log("\n--- Deleting Auth Users ---\n");

  let deleted = 0;
  let superAdminUid = "";
  let nextPageToken: string | undefined;

  do {
    const listResult = await auth.listUsers(1000, nextPageToken);
    const uidsToDelete: string[] = [];

    for (const user of listResult.users) {
      if (user.email === SUPER_ADMIN_EMAIL) {
        superAdminUid = user.uid;
        console.log(`  Keeping super admin: ${user.email} (${user.uid})`);
        continue;
      }
      uidsToDelete.push(user.uid);
    }

    if (uidsToDelete.length > 0) {
      if (!DRY_RUN) {
        const result = await auth.deleteUsers(uidsToDelete);
        if (result.errors.length > 0) {
          console.warn(`  Errors deleting some users:`, result.errors.map(e => e.error.message));
        }
      }
      deleted += uidsToDelete.length;
      console.log(`  ${DRY_RUN ? "[DRY RUN] Would delete" : "Deleted"} ${uidsToDelete.length} auth users`);
    }

    nextPageToken = listResult.pageToken;
  } while (nextPageToken);

  // Reset super admin claims
  if (superAdminUid) {
    if (!DRY_RUN) {
      await auth.setCustomUserClaims(superAdminUid, {
        role: "super_admin",
        institutionId: "",
        activeInstitutionId: "",
      });
    }
    console.log(`  ${DRY_RUN ? "[DRY RUN] Would reset" : "Reset"} super admin claims for ${SUPER_ADMIN_EMAIL}`);
  } else {
    console.warn(`\n  WARNING: Super admin ${SUPER_ADMIN_EMAIL} not found in Auth!`);
  }

  return { deleted, kept: superAdminUid };
}

async function main() {
  console.log("=".repeat(60));
  console.log("  FIREBASE RESET TO FRESH STATE");
  console.log(`  Super admin to keep: ${SUPER_ADMIN_EMAIL}`);
  if (DRY_RUN) {
    console.log("  MODE: DRY RUN (no changes will be made)");
  } else {
    console.log("  MODE: LIVE — THIS WILL DELETE ALL DATA!");
  }
  console.log("=".repeat(60));

  if (!DRY_RUN) {
    // Give user 5 seconds to abort
    console.log("\n  Starting in 5 seconds... Press Ctrl+C to abort.\n");
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  const docsDeleted = await deleteAllFirestoreData();
  const { deleted: usersDeleted, kept } = await deleteAllAuthUsers();

  console.log("\n" + "=".repeat(60));
  console.log("  RESET COMPLETE");
  console.log(`  Firestore documents deleted: ${docsDeleted}`);
  console.log(`  Auth users deleted: ${usersDeleted}`);
  console.log(`  Super admin kept: ${kept ? `${SUPER_ADMIN_EMAIL} (${kept})` : "NOT FOUND"}`);
  console.log("=".repeat(60));

  if (!DRY_RUN && kept) {
    console.log(`
NEXT STEPS:
  1. The super admin (${SUPER_ADMIN_EMAIL}) must sign out and sign back in
  2. On login, the onUserCreate Cloud Function will create a new user doc
  3. Run: npx tsx scripts/set-admin-role.ts ${SUPER_ADMIN_EMAIL}
     to set the super_admin role
  4. Sign out and back in again for claims to take effect
  5. Create a new institution from the admin panel
`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Reset failed:", err);
    process.exit(1);
  });
