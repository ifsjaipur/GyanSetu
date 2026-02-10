import "server-only";

import {
  initializeApp,
  getApps,
  cert,
  type ServiceAccount,
  type App,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let _app: App | undefined;
let _auth: Auth | undefined;
let _db: Firestore | undefined;

function getAdminApp(): App {
  if (_app) return _app;

  if (getApps().length > 0) {
    _app = getApps()[0];
    return _app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin SDK credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables."
    );
  }

  const serviceAccount: ServiceAccount = {
    projectId,
    clientEmail,
    privateKey,
  };

  _app = initializeApp({ credential: cert(serviceAccount) });
  return _app;
}

/** Lazily initialized Firebase Admin Auth */
export function getAdminAuth(): Auth {
  if (!_auth) {
    _auth = getAuth(getAdminApp());
  }
  return _auth;
}

/** Lazily initialized Firebase Admin Firestore */
export function getAdminDb(): Firestore {
  if (!_db) {
    _db = getFirestore(getAdminApp());
  }
  return _db;
}

// Convenience aliases (lazy)
export const adminAuth = { get: getAdminAuth };
export const adminDb = { get: getAdminDb };
