import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import { writeAuditLog } from "@/lib/audit-log";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "__session";
const MAX_AGE = parseInt(process.env.SESSION_COOKIE_MAX_AGE || "432000") * 1000; // ms

const GENERIC_DOMAINS = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com", "icloud.com", "protonmail.com"];

/** Helper to create an approved membership doc */
async function createMembership(
  db: FirebaseFirestore.Firestore,
  uid: string,
  institutionId: string,
  role: string,
  joinMethod: string,
) {
  await db
    .collection("users")
    .doc(uid)
    .collection("memberships")
    .doc(institutionId)
    .set({
      id: institutionId,
      userId: uid,
      institutionId,
      role,
      status: "approved",
      isExternal: false,
      joinMethod,
      requestedAt: FieldValue.serverTimestamp(),
      reviewedAt: FieldValue.serverTimestamp(),
      reviewedBy: null,
      reviewNote: null,
      transferredTo: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
}

/**
 * Ensure a Firestore user document exists for this user.
 * - ALL users auto-enroll in the Global (mother) institution
 * - Org-domain users also match to specific institutions with role "instructor"
 * - Generic email users get role "student"
 */
async function ensureUserDoc(uid: string, email: string, displayName: string, photoURL: string | null) {
  const db = getAdminDb();
  const userRef = db.collection("users").doc(uid);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    const emailDomain = email.split("@")[1];
    const isGenericEmail = GENERIC_DOMAINS.includes(emailDomain.toLowerCase());

    // 1. Always find the Global (mother) institution — every user gets enrolled here
    let motherInstitutionId = "";
    const motherSnap = await db
      .collection("institutions")
      .where("institutionType", "==", "mother")
      .where("isActive", "==", true)
      .limit(1)
      .get();
    if (!motherSnap.empty) {
      motherInstitutionId = motherSnap.docs[0].id;
    }

    // 2. Domain match — org email users get matched to a specific institution
    let domainMatchedId = "";
    if (!isGenericEmail) {
      const institutionsSnap = await db.collection("institutions").get();
      for (const doc of institutionsSnap.docs) {
        const inst = doc.data();
        if (inst.isActive && inst.allowedEmailDomains?.includes(emailDomain)) {
          domainMatchedId = doc.id;
          break;
        }
      }
    }

    // 3. Determine role and primary institution
    const isDomainUser = !!domainMatchedId;
    const userRole = isDomainUser ? "instructor" : "student";
    // Domain users: primary = matched institution; others: primary = Global
    const primaryInstitutionId = domainMatchedId || motherInstitutionId;
    const isExternal = !primaryInstitutionId;

    await userRef.set({
      uid,
      email,
      displayName: displayName || "",
      photoUrl: photoURL || null,
      phone: null,
      gender: null,
      institutionId: primaryInstitutionId,
      activeInstitutionId: primaryInstitutionId || null,
      role: userRole,
      isExternal,
      consentGiven: false,
      consentGivenAt: null,
      profileComplete: !isExternal,
      googleWorkspaceUserId: null,
      address: null,
      profile: {
        bio: null,
        dateOfBirth: null,
        enrollmentNumber: null,
        department: null,
      },
      parentGuardian: null,
      preferences: {
        emailNotifications: true,
        language: "en",
      },
      isActive: true,
      lastLoginAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 4. Create memberships
    // Always enroll in Global if it exists
    if (motherInstitutionId) {
      await createMembership(db, uid, motherInstitutionId, userRole, "auto_global");
    }
    // Domain users also get membership in their matched institution
    if (domainMatchedId && domainMatchedId !== motherInstitutionId) {
      await createMembership(db, uid, domainMatchedId, "instructor", "email_domain");
    }

    console.log(`Created user doc for ${email} (${uid}), role=${userRole}, primary=${primaryInstitutionId}`);
  } else {
    // Existing user — read role from Firestore (not stale token claims)
    const existingData = userDoc.data()!;
    await userRef.update({ lastLoginAt: FieldValue.serverTimestamp() });

    // Backfill missing Global membership
    const motherSnap = await db
      .collection("institutions")
      .where("institutionType", "==", "mother")
      .where("isActive", "==", true)
      .limit(1)
      .get();
    if (!motherSnap.empty) {
      const motherId = motherSnap.docs[0].id;
      const globalMemberRef = db.collection("users").doc(uid).collection("memberships").doc(motherId);
      const globalMemberDoc = await globalMemberRef.get();
      if (!globalMemberDoc.exists) {
        await createMembership(db, uid, motherId, existingData.role || "student", "auto_global");
        console.log(`Backfilled Global membership for ${email}`);
      }
    }

    // Backfill missing primary institution membership
    const userInstitutionId = existingData.institutionId;
    if (userInstitutionId) {
      const membershipRef = db.collection("users").doc(uid).collection("memberships").doc(userInstitutionId);
      const membershipDoc = await membershipRef.get();
      if (!membershipDoc.exists) {
        await createMembership(db, uid, userInstitutionId, existingData.role || "student", "email_domain");
        console.log(`Backfilled membership for ${email} in ${userInstitutionId}`);
      }
    }
  }
}

/**
 * POST /api/auth/session
 * Exchange a Firebase ID token for a session cookie.
 * Also ensures a Firestore user document exists.
 */
export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();
    if (!idToken) {
      return NextResponse.json(
        { error: "Missing idToken" },
        { status: 400 }
      );
    }

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(idToken);
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: MAX_AGE,
    });

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, sessionCookie, {
      maxAge: MAX_AGE / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    // Ensure user doc exists (handles reset/missing doc scenarios)
    const authUser = await adminAuth.getUser(decoded.uid);
    await ensureUserDoc(
      decoded.uid,
      decoded.email || "",
      authUser.displayName || decoded.name || "",
      authUser.photoURL || null,
    );

    // Read fresh role/institutionId from the user doc (not stale token claims)
    const freshUserDoc = await getAdminDb().collection("users").doc(decoded.uid).get();
    const freshData = freshUserDoc.data();

    writeAuditLog({
      institutionId: freshData?.institutionId || "",
      userId: decoded.uid,
      userEmail: decoded.email || "",
      userRole: freshData?.role || "student",
      action: "auth.login",
      resource: "session",
      resourceId: decoded.uid,
    }, request);

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Session creation failed:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 401 }
    );
  }
}

/**
 * DELETE /api/auth/session
 * Clear the session cookie (logout).
 */
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  return NextResponse.json({ status: "ok" });
}
