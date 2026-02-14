import * as functions from "firebase-functions/v1";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";

if (getApps().length === 0) {
  initializeApp();
}

const adminAuth = getAuth();
const db = getFirestore();

/**
 * Triggered when a new user signs in via Firebase Auth.
 *
 * For domain users (email matches an institution's allowedEmailDomains):
 *   - Creates an approved membership in that institution
 *   - Sets custom claims with that institutionId
 *   - profileComplete = true
 *
 * For external users (Gmail, etc.):
 *   - Creates user doc with no institution assignment
 *   - User must complete profile + select institution(s) manually
 *   - profileComplete = false
 */
export const onUserCreate = functions.region("asia-south1").auth.user().onCreate(async (user) => {
  if (!user.email) {
    console.warn(`User ${user.uid} created without email, skipping.`);
    return;
  }

  const emailDomain = user.email.split("@")[1];
  const role = "student";

  // Generic email providers should NOT auto-assign to an institution
  // even if they are in allowedEmailDomains (those users must choose explicitly)
  const genericDomains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com", "icloud.com", "protonmail.com"];
  const isGenericEmail = genericDomains.includes(emailDomain.toLowerCase());

  // Find institution by email domain (org-specific domains only)
  const institutionsSnap = await db.collection("institutions").get();

  let matchedInstitutionId: string | null = null;

  if (!isGenericEmail) {
    for (const doc of institutionsSnap.docs) {
      const inst = doc.data();
      if (!inst.isActive) continue;

      // Check if user's domain matches the institution's allowed domains
      if (inst.allowedEmailDomains?.includes(emailDomain)) {
        matchedInstitutionId = doc.id;
        break;
      }
    }
  }

  const isExternal = !matchedInstitutionId;

  // Set custom claims
  await adminAuth.setCustomUserClaims(user.uid, {
    role,
    institutionId: matchedInstitutionId || "",
    activeInstitutionId: matchedInstitutionId || "",
  });

  // Create user document in Firestore
  await db
    .collection("users")
    .doc(user.uid)
    .set({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || "",
      photoUrl: user.photoURL || null,
      phone: user.phoneNumber || null,
      institutionId: matchedInstitutionId || "",
      activeInstitutionId: matchedInstitutionId || null,
      role,
      isExternal,
      consentGiven: false,
      consentGivenAt: null,
      profileComplete: !isExternal, // Internal users have profile complete by default
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

  // For domain users: create an approved membership in the matched institution
  if (matchedInstitutionId) {
    await db
      .collection("users")
      .doc(user.uid)
      .collection("memberships")
      .doc(matchedInstitutionId)
      .set({
        id: matchedInstitutionId,
        userId: user.uid,
        institutionId: matchedInstitutionId,
        role,
        status: "approved",
        isExternal: false,
        joinMethod: "email_domain",
        requestedAt: FieldValue.serverTimestamp(),
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: null, // auto-approved
        reviewNote: null,
        transferredTo: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    console.log(
      `User ${user.uid} (${user.email}) auto-assigned to institution ${matchedInstitutionId} via email domain`
    );
  } else {
    console.log(
      `User ${user.uid} (${user.email}) is external — needs to select institution(s)`
    );
  }
});
