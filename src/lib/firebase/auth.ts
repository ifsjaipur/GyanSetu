import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { getClientAuth } from "./client";

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("email");
googleProvider.addScope("profile");

export async function signInWithGoogle(): Promise<FirebaseUser> {
  const result = await signInWithPopup(getClientAuth(), googleProvider);
  return result.user;
}

export async function signOut(): Promise<void> {
  // Clear server session cookie
  await fetch("/api/auth/session", { method: "DELETE" });
  // Sign out from Firebase client
  await firebaseSignOut(getClientAuth());
}

export async function getIdToken(): Promise<string | null> {
  const user = getClientAuth().currentUser;
  if (!user) return null;
  return user.getIdToken();
}

export async function createSessionCookie(): Promise<void> {
  const idToken = await getIdToken();
  if (!idToken) throw new Error("Not authenticated");

  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    throw new Error("Failed to create session");
  }
}
