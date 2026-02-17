import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

// Allow up to 60s for this heavy operation (Vercel Hobby max)
export const maxDuration = 60;

const BATCH_SIZE = 400; // Stay under Firestore's 500-op batch limit

const VALID_CATEGORIES = [
  "institutions",
  "users",
  "courses",
  "enrollments",
  "payments",
  "certificates",
  "exams",
  "attendance",
  "videoProgress",
  "zoomMeetings",
  "auditLogs",
  "pushSubscriptions",
] as const;

type Category = (typeof VALID_CATEGORIES)[number];

/** Delete all docs in a collection (no institutionId filter — full wipe) */
async function deleteCollectionAll(
  db: FirebaseFirestore.Firestore,
  collectionPath: string,
  excludeDocIds?: string[]
): Promise<number> {
  let deleted = 0;
  const excludeSet = new Set(excludeDocIds || []);

  let snap = await db.collection(collectionPath).limit(BATCH_SIZE).get();
  while (!snap.empty) {
    const batch = db.batch();
    let batchCount = 0;
    for (const doc of snap.docs) {
      if (excludeSet.has(doc.id)) continue;
      batch.delete(doc.ref);
      deleted++;
      batchCount++;
    }
    if (batchCount > 0) await batch.commit();

    // If all docs were excluded, stop to avoid infinite loop
    if (batchCount === 0) break;
    snap = await db.collection(collectionPath).limit(BATCH_SIZE).get();
  }
  return deleted;
}

/** Delete subcollections of a doc, then the doc itself */
async function deleteCourseSubcollections(
  db: FirebaseFirestore.Firestore,
  courseId: string
): Promise<void> {
  const courseRef = db.collection("courses").doc(courseId);

  // Delete lessons inside each module
  const modulesSnap = await courseRef.collection("modules").get();
  await Promise.all(
    modulesSnap.docs.map(async (moduleDoc) => {
      const lessonsSnap = await courseRef
        .collection("modules")
        .doc(moduleDoc.id)
        .collection("lessons")
        .get();

      if (lessonsSnap.empty) {
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

/** Delete all courses with their modules/lessons/sessions */
async function deleteAllCourses(db: FirebaseFirestore.Firestore): Promise<number> {
  const coursesSnap = await db.collection("courses").get();
  const courseDocs = coursesSnap.docs;

  // Process up to 10 courses in parallel for subcollection cleanup
  for (let i = 0; i < courseDocs.length; i += 10) {
    const chunk = courseDocs.slice(i, i + 10);
    await Promise.all(
      chunk.map((courseDoc) => deleteCourseSubcollections(db, courseDoc.id))
    );
  }

  // Delete course docs in batches
  for (let i = 0; i < courseDocs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const slice = courseDocs.slice(i, i + BATCH_SIZE);
    for (const courseDoc of slice) {
      batch.delete(courseDoc.ref);
    }
    await batch.commit();
  }

  return coursesSnap.size;
}

/** Delete all users (except requesting admin) + their memberships + Firebase Auth */
async function deleteAllUsers(
  db: FirebaseFirestore.Firestore,
  auth: ReturnType<typeof getAdminAuth>,
  requestingUid: string
): Promise<number> {
  let deleted = 0;

  let snap = await db.collection("users").limit(BATCH_SIZE).get();
  while (!snap.empty) {
    const batch = db.batch();
    const authDeletePromises: Promise<void>[] = [];
    let batchCount = 0;

    for (const doc of snap.docs) {
      if (doc.id === requestingUid) continue;

      // Delete memberships subcollection
      const membershipsSnap = await db
        .collection("users")
        .doc(doc.id)
        .collection("memberships")
        .get();
      if (!membershipsSnap.empty) {
        const subBatch = db.batch();
        for (const memDoc of membershipsSnap.docs) {
          subBatch.delete(memDoc.ref);
        }
        await subBatch.commit();
      }

      batch.delete(doc.ref);
      deleted++;
      batchCount++;

      authDeletePromises.push(
        auth.deleteUser(doc.id).catch(() => {
          // User may not exist in Auth — ignore
        })
      );
    }

    if (batchCount > 0) {
      await Promise.all([batch.commit(), ...authDeletePromises]);
    } else {
      break; // Only excluded user remains
    }

    snap = await db.collection("users").limit(BATCH_SIZE).get();
  }

  // Also delete the requesting admin's memberships (but keep their user doc)
  const adminMembershipsSnap = await db
    .collection("users")
    .doc(requestingUid)
    .collection("memberships")
    .get();
  if (!adminMembershipsSnap.empty) {
    const batch = db.batch();
    for (const doc of adminMembershipsSnap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }

  return deleted;
}

/** Delete zoomMeetings + their participants subcollection */
async function deleteAllZoomMeetings(db: FirebaseFirestore.Firestore): Promise<number> {
  const meetingsSnap = await db.collection("zoomMeetings").get();

  for (const meetingDoc of meetingsSnap.docs) {
    const participantsSnap = await db
      .collection("zoomMeetings")
      .doc(meetingDoc.id)
      .collection("participants")
      .get();
    if (!participantsSnap.empty) {
      const batch = db.batch();
      for (const doc of participantsSnap.docs) {
        batch.delete(doc.ref);
      }
      await batch.commit();
    }
  }

  // Now delete meeting docs
  for (let i = 0; i < meetingsSnap.docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const slice = meetingsSnap.docs.slice(i, i + BATCH_SIZE);
    for (const doc of slice) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }

  return meetingsSnap.size;
}

/**
 * POST /api/admin/reset-data
 * Selective data wipe. Super admin only.
 * Body: { confirmPhrase: "DELETE ALL DATA", categories: string[] }
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

    const categories: string[] = body.categories || [];
    const validCategories = categories.filter((c): c is Category =>
      VALID_CATEGORIES.includes(c as Category)
    );

    if (validCategories.length === 0) {
      return NextResponse.json(
        { error: "No valid categories selected" },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const auth = getAdminAuth();
    const counts: Record<string, number> = {};

    for (const category of validCategories) {
      switch (category) {
        case "institutions":
          // Delete all institutions (no filter — full wipe across all institutions)
          counts.institutions = await deleteCollectionAll(db, "institutions");
          break;

        case "users":
          counts.users = await deleteAllUsers(db, auth, decoded.uid);
          break;

        case "courses":
          counts.courses = await deleteAllCourses(db);
          break;

        case "exams":
          // Delete both exams and examAttempts
          counts.exams = await deleteCollectionAll(db, "exams");
          counts.examAttempts = await deleteCollectionAll(db, "examAttempts");
          break;

        case "zoomMeetings":
          counts.zoomMeetings = await deleteAllZoomMeetings(db);
          break;

        case "enrollments":
        case "payments":
        case "certificates":
        case "attendance":
        case "videoProgress":
        case "auditLogs":
        case "pushSubscriptions":
          counts[category] = await deleteCollectionAll(db, category);
          break;
      }
    }

    // Always ensure admin role is preserved after any reset
    const adminRef = db.collection("users").doc(decoded.uid);
    const adminDoc = await adminRef.get();

    if (validCategories.includes("institutions") || validCategories.includes("users")) {
      await auth.setCustomUserClaims(decoded.uid, {
        role: "super_admin",
        institutionId: "",
        activeInstitutionId: "",
      });

      if (adminDoc.exists) {
        await adminRef.update({
          role: "super_admin",
          institutionId: "",
          activeInstitutionId: "",
        });
      }
    }

    return NextResponse.json({
      message: "Data reset complete",
      counts,
      deletedCategories: validCategories,
      preserved: {
        adminUser: decoded.uid,
      },
    });
  } catch (err) {
    console.error("Reset data failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
