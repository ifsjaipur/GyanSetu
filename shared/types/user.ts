import type { Timestamp } from "firebase/firestore";
import type { UserRole } from "../enums/roles";

export interface UserAddress {
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
}

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

export type GuardianRelation = "father" | "mother" | "guardian" | "other";

export interface ParentGuardian {
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  relation: GuardianRelation;
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoUrl: string | null;
  phone: string | null;
  gender: string | null;
  /** Primary/active institution — kept for backward compat with existing queries */
  institutionId: string;
  /** Currently active institution (same as institutionId, explicit field for multi-inst) */
  activeInstitutionId: string | null;
  role: UserRole;
  isExternal: boolean;
  consentGiven: boolean;
  consentGivenAt: Timestamp | null;
  profileComplete: boolean;
  googleWorkspaceUserId: string | null;
  address: UserAddress | null;
  profile: UserProfile;
  parentGuardian: ParentGuardian | null;
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
  activeInstitutionId?: string;
}
