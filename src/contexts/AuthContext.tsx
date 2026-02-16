"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { getClientAuth, getClientDb } from "@/lib/firebase/client";
import type { User } from "@shared/types/user";
import type { InstitutionMembership } from "@shared/types/membership";

interface AuthState {
  firebaseUser: FirebaseUser | null;
  userData: User | null;
  memberships: InstitutionMembership[];
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  refreshUser: () => Promise<void>;
  needsInstitutionSelection: boolean;
  approvedInstitutionIds: string[];
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    firebaseUser: null,
    userData: null,
    memberships: [],
    loading: true,
    error: null,
  });

  async function fetchUserData(firebaseUser: FirebaseUser, attempt = 0) {
    const maxAttempts = 2;
    const delay = attempt === 0 ? 500 : 1000; // exponential backoff
    try {
      const db = getClientDb();
      const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;

        // Fetch memberships — don't let this fail the entire auth load
        let memberships: InstitutionMembership[] = [];
        try {
          const membershipsSnap = await getDocs(
            collection(db, "users", firebaseUser.uid, "memberships")
          );
          memberships = membershipsSnap.docs.map(
            (d) => d.data() as InstitutionMembership
          );
        } catch (membershipErr) {
          console.warn("Memberships fetch failed (non-blocking):", membershipErr);
        }

        setState({
          firebaseUser,
          userData,
          memberships,
          loading: false,
          error: null,
        });
      } else if (attempt < maxAttempts) {
        // User document not yet created (Cloud Function may be processing)
        setTimeout(() => fetchUserData(firebaseUser, attempt + 1), delay);
      } else {
        setState({
          firebaseUser,
          userData: null,
          memberships: [],
          loading: false,
          error: null,
        });
      }
    } catch (err) {
      console.warn("fetchUserData error (attempt " + attempt + "):", err);
      // Firestore permission error — likely new user whose claims haven't propagated yet
      if (attempt < maxAttempts) {
        setTimeout(() => fetchUserData(firebaseUser, attempt + 1), delay);
      } else {
        setState({
          firebaseUser,
          userData: null,
          memberships: [],
          loading: false,
          error: null,
        });
      }
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getClientAuth(), async (firebaseUser) => {
      if (firebaseUser) {
        await fetchUserData(firebaseUser);
      } else {
        setState({
          firebaseUser: null,
          userData: null,
          memberships: [],
          loading: false,
          error: null,
        });
      }
    });

    return () => unsubscribe();
  }, []);

  async function refreshUser() {
    if (state.firebaseUser) {
      // Force refresh the ID token to pick up any claim changes (e.g. after membership approval)
      try {
        const freshToken = await state.firebaseUser.getIdToken(true);
        // Re-create session cookie with fresh claims
        await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: freshToken }),
        });
      } catch (err) {
        console.warn("Token refresh failed (non-blocking):", err);
      }
      await fetchUserData(state.firebaseUser);
    }
  }

  const needsInstitutionSelection =
    !!state.userData?.isExternal &&
    !state.memberships.some((m) => m.status === "approved");

  const approvedInstitutionIds = state.memberships
    .filter((m) => m.status === "approved")
    .map((m) => m.institutionId);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        refreshUser,
        needsInstitutionSelection,
        approvedInstitutionIds,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
