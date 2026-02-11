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
 * 1. Matches the user's email domain to an institution
 * 2. Determines if the user is external (Gmail) or internal (Workspace)
 * 3. Sets custom claims: { role, institutionId }
 * 4. Creates a user document in Firestore
 */
export const onUserCreate = functions.region("asia-south1").auth.user().onCreate(async (user) => {
  if (!user.email) {
    console.warn(`User ${user.uid} created without email, skipping.`);
    return;
  }

  const emailDomain = user.email.split("@")[1];

  // Find institution by email domain
  const institutionsSnap = await db.collection("institutions").get();

  let matchedInstitutionId: string | null = null;
  let isExternal = true;

  for (const doc of institutionsSnap.docs) {
    const inst = doc.data();
    if (!inst.isActive) continue;

    // Check if user's domain matches the institution's allowed domains
    if (inst.allowedEmailDomains?.includes(emailDomain)) {
      matchedInstitutionId = doc.id;
      isExternal = false;
      break;
    }

    // If institution allows external users and no match yet,
    // use the default institution (first active one)
    if (inst.settings?.allowExternalUsers && !matchedInstitutionId) {
      matchedInstitutionId = doc.id;
      isExternal = true;
    }
  }

  if (!matchedInstitutionId) {
    console.warn(
      `No matching institution for email ${user.email}. User ${user.uid} will not have claims set.`
    );
    return;
  }

  const role = "student"; // Default role for all new users

  // Set custom claims
  await adminAuth.setCustomUserClaims(user.uid, {
    role,
    institutionId: matchedInstitutionId,
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
      institutionId: matchedInstitutionId,
      role,
      isExternal,
      consentGiven: false,
      consentGivenAt: null,
      profileComplete: !isExternal, // Internal users have profile complete by default
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
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

  console.log(
    `User ${user.uid} (${user.email}) assigned to institution ${matchedInstitutionId} as ${role} (external: ${isExternal})`
  );
});
