import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import { writeAuditLog } from "@/lib/audit-log";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "__session";
const MAX_AGE = parseInt(process.env.SESSION_COOKIE_MAX_AGE || "432000") * 1000; // ms

/**
 * Ensure a Firestore user document exists for this user.
 * Handles the case where Auth user exists but Firestore doc was deleted
 * (e.g. after a data reset) or Cloud Function hasn't run yet.
 */
async function ensureUserDoc(uid: string, email: string, displayName: string, photoURL: string | null, role: string, institutionId: string) {
  const db = getAdminDb();
  const userRef = db.collection("users").doc(uid);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    const emailDomain = email.split("@")[1];
    let matchedInstitutionId = institutionId || "";

    // If no institutionId in claims, try to find one by email domain
    if (!matchedInstitutionId) {
      const institutionsSnap = await db.collection("institutions").get();
      for (const doc of institutionsSnap.docs) {
        const inst = doc.data();
        if (inst.isActive && inst.allowedEmailDomains?.includes(emailDomain)) {
          matchedInstitutionId = doc.id;
          break;
        }
      }
    }

    const isExternal = !matchedInstitutionId;

    await userRef.set({
      uid,
      email,
      displayName: displayName || "",
      photoUrl: photoURL || null,
      phone: null,
      institutionId: matchedInstitutionId,
      activeInstitutionId: matchedInstitutionId || null,
      role: role || "student",
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

    // Create approved membership if institution matched
    if (matchedInstitutionId) {
      await db
        .collection("users")
        .doc(uid)
        .collection("memberships")
        .doc(matchedInstitutionId)
        .set({
          id: matchedInstitutionId,
          userId: uid,
          institutionId: matchedInstitutionId,
          role: role || "student",
          status: "approved",
          isExternal: false,
          joinMethod: "email_domain",
          requestedAt: FieldValue.serverTimestamp(),
          reviewedAt: FieldValue.serverTimestamp(),
          reviewedBy: null,
          reviewNote: null,
          transferredTo: null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
    }

    console.log(`Created missing user doc for ${email} (${uid})`);
  } else {
    // Update lastLoginAt on existing doc
    await userRef.update({ lastLoginAt: FieldValue.serverTimestamp() });
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
      decoded.role || "student",
      decoded.institutionId || "",
    );

    writeAuditLog({
      institutionId: decoded.institutionId || "",
      userId: decoded.uid,
      userEmail: decoded.email || "",
      userRole: decoded.role || "student",
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
