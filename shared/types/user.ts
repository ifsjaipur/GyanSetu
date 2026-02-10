import type { Timestamp } from "firebase/firestore";
import type { UserRole } from "../enums/roles";

export interface UserProfile {
  bio: string | null;
  dateOfBirth: string | null;
  enrollmentNumber: string | null;
  department: string | null;
}

export interface UserPreferences {
  emailNotifications: boolean;
  language: string;
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoUrl: string | null;
  phone: string | null;
  institutionId: string;
  role: UserRole;
  isExternal: boolean;
  consentGiven: boolean;
  consentGivenAt: Timestamp | null;
  profileComplete: boolean;
  googleWorkspaceUserId: string | null;
  profile: UserProfile;
  preferences: UserPreferences;
  isActive: boolean;
  lastLoginAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Custom claims stored on Firebase Auth token */
export interface CustomClaims {
  role: UserRole;
  institutionId: string;
}
