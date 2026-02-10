"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getClientAuth, getClientDb } from "@/lib/firebase/client";
import type { User } from "@shared/types/user";

interface AuthState {
  firebaseUser: FirebaseUser | null;
  userData: User | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    firebaseUser: null,
    userData: null,
    loading: true,
    error: null,
  });

  async function fetchUserData(firebaseUser: FirebaseUser) {
    try {
      const userDoc = await getDoc(doc(getClientDb(), "users", firebaseUser.uid));
      if (userDoc.exists()) {
        setState({
          firebaseUser,
          userData: userDoc.data() as User,
          loading: false,
          error: null,
        });
      } else {
        // User document not yet created (Cloud Function may be processing)
        setState({
          firebaseUser,
          userData: null,
          loading: false,
          error: null,
        });
      }
    } catch (err) {
      console.error("Error fetching user data:", err);
      setState({
        firebaseUser,
        userData: null,
        loading: false,
        error: "Failed to load user profile",
      });
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
          loading: false,
          error: null,
        });
      }
    });

    return () => unsubscribe();
  }, []);

  async function refreshUser() {
    if (state.firebaseUser) {
      await fetchUserData(state.firebaseUser);
    }
  }

  return (
    <AuthContext.Provider value={{ ...state, refreshUser }}>
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
