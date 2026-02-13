import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { writeAuditLog } from "@/lib/audit-log";

// Allow up to 60s for this heavy operation (Vercel Hobby max)
export const maxDuration = 60;

const BATCH_SIZE = 400; // Stay under Firestore's 500-op batch limit

async function deleteCollection(
  db: FirebaseFirestore.Firestore,
  collectionPath: string,
  institutionId: string,
  excludeDocId?: string
): Promise<number> {
  let deleted = 0;
  let query = db
    .collection(collectionPath)
    .where("institutionId", "==", institutionId)
    .limit(BATCH_SIZE);

  let snap = await query.get();
  while (!snap.empty) {
    const batch = db.batch();
    for (const doc of snap.docs) {
      if (excludeDocId && doc.id === excludeDocId) continue;
      batch.delete(doc.ref);
      deleted++;
    }
    await batch.commit();
    snap = await query.get();
  }
  return deleted;
}

async function deleteCourseSubcollections(
  db: FirebaseFirestore.Firestore,
  courseId: string
): Promise<void> {
  const courseRef = db.collection("courses").doc(courseId);

  // Delete lessons inside each module
  const modulesSnap = await courseRef.collection("modules").get();

  // Process all modules in parallel
  await Promise.all(
    modulesSnap.docs.map(async (moduleDoc) => {
      const lessonsSnap = await courseRef
        .collection("modules")
        .doc(moduleDoc.id)
        .collection("lessons")
        .get();

      if (lessonsSnap.empty) {
        // Just delete the module doc
        await moduleDoc.ref.delete();
        return;
      }

      const batch = db.batch();
      for (const lessonDoc of lessonsSnap.docs) {
        batch.delete(lessonDoc.ref);
      }
      batch.delete(moduleDoc.ref);
      await batch.commit();
    })
  );

  // Delete sessions subcollection
  const sessionsSnap = await courseRef.collection("sessions").get();
  if (!sessionsSnap.empty) {
    const batch = db.batch();
    for (const doc of sessionsSnap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }
}

async function deleteUsersWithAuth(
  db: FirebaseFirestore.Firestore,
  auth: ReturnType<typeof getAdminAuth>,
  institutionId: string,
  requestingUid: string
): Promise<number> {
  let deleted = 0;
  let query = db
    .collection("users")
    .where("institutionId", "==", institutionId)
    .limit(BATCH_SIZE);

  let snap = await query.get();
  while (!snap.empty) {
    const batch = db.batch();
    const authDeletePromises: Promise<void>[] = [];

    for (const doc of snap.docs) {
      if (doc.id === requestingUid) continue;
      batch.delete(doc.ref);
      deleted++;

      // Queue Auth deletion in parallel instead of awaiting each one
      authDeletePromises.push(
        auth.deleteUser(doc.id).catch(() => {
          // User may not exist in Auth — ignore
        })
      );
    }

    // Run Firestore batch and Auth deletions in parallel
    await Promise.all([batch.commit(), ...authDeletePromises]);

    // Re-query (excluding already deleted)
    snap = await query.get();
  }
  return deleted;
}

/**
 * POST /api/admin/reset-data
 * Full data wipe for an institution. Super admin only.
 * Requires confirmPhrase: "DELETE ALL DATA"
 */
export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("__session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    if (decoded.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden — super admin only" }, { status: 403 });
    }

    const body = await request.json();
    if (body.confirmPhrase !== "DELETE ALL DATA") {
      return NextResponse.json(
        { error: "Invalid confirmation phrase" },
        { status: 400 }
      );
    }

    const institutionId = decoded.institutionId;
    if (!institutionId) {
      return NextResponse.json({ error: "No institution assigned" }, { status: 400 });
    }

    const db = getAdminDb();
    const auth = getAdminAuth();
    const counts: Record<string, number> = {};

    // 1. Delete courses + subcollections (parallelize subcollection cleanup)
    const coursesSnap = await db
      .collection("courses")
      .where("institutionId", "==", institutionId)
      .get();

    // Process up to 10 courses in parallel for subcollection cleanup
    const courseChunks: FirebaseFirestore.QueryDocumentSnapshot[][] = [];
    const courseDocs = coursesSnap.docs;
    for (let i = 0; i < courseDocs.length; i += 10) {
      courseChunks.push(courseDocs.slice(i, i + 10));
    }
    for (const chunk of courseChunks) {
      await Promise.all(
        chunk.map((courseDoc) => deleteCourseSubcollections(db, courseDoc.id))
      );
    }

    // Now delete course docs in batches
    for (let i = 0; i < courseDocs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const slice = courseDocs.slice(i, i + BATCH_SIZE);
      for (const courseDoc of slice) {
        batch.delete(courseDoc.ref);
      }
      await batch.commit();
    }
    counts.courses = coursesSnap.size;

    // 2. Delete users (except requesting admin) + their Firebase Auth accounts
    counts.users = await deleteUsersWithAuth(db, auth, institutionId, decoded.uid);

    // 3. Delete other collections — run independent collections in parallel
    const collections = [
      "enrollments",
      "payments",
      "attendance",
      "certificates",
      "exams",
      "examAttempts",
      "videoProgress",
      "auditLogs",
    ];

    const collectionResults = await Promise.all(
      collections.map((col) => deleteCollection(db, col, institutionId))
    );
    collections.forEach((col, i) => {
      counts[col] = collectionResults[i];
    });

    writeAuditLog({
      institutionId,
      userId: decoded.uid,
      userEmail: decoded.email || "",
      userRole: decoded.role,
      action: "admin.reset_data",
      resource: "institution",
      resourceId: institutionId,
      details: { counts },
      severity: "critical",
    }, request);

    return NextResponse.json({
      message: "Data reset complete",
      counts,
      preserved: {
        institution: institutionId,
        adminUser: decoded.uid,
      },
    });
  } catch (err) {
    console.error("Reset data failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
