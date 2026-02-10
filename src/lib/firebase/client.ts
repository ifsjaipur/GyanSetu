import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

function getFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) return getApp();
  return initializeApp(firebaseConfig);
}

function createAuth(): Auth {
  return getAuth(getFirebaseApp());
}

function createDb(): Firestore {
  return getFirestore(getFirebaseApp());
}

// Lazy singletons — only initialize when actually called at runtime
let _auth: Auth | null = null;
let _db: Firestore | null = null;

export function getClientAuth(): Auth {
  if (!_auth) _auth = createAuth();
  return _auth;
}

export function getClientDb(): Firestore {
  if (!_db) _db = createDb();
  return _db;
}
