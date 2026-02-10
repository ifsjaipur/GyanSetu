import type { Timestamp } from "firebase/firestore";

export interface InstitutionBranding {
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  headerBgColor: string;
  footerText: string;
  institutionTagline: string;
}

export interface InstitutionGoogleWorkspace {
  customerDomain: string;
  adminEmail: string;
  serviceAccountKeyRef: string;
  classroomTeacherEmail: string;
}

export interface InstitutionRazorpay {
  keyId: string;
  keySecretRef: string;
  webhookSecretRef: string;
}

export interface InstitutionSettings {
  defaultCourseAccessDays: number;
  certificateTemplateDocId: string;
  certificateFolderId: string;
  videoStorageBucket: string;
  enableSelfRegistration: boolean;
  allowExternalUsers: boolean;
  requireEmailVerification: boolean;
  maintenanceMode: boolean;
}

export interface InstitutionContactInfo {
  supportEmail: string;
  phone: string;
  address: string;
  website: string;
}

export interface Institution {
  id: string;
  name: string;
  slug: string;
  domains: string[];
  primaryDomain: string;
  allowedEmailDomains: string[];
  branding: InstitutionBranding;
  googleWorkspace: InstitutionGoogleWorkspace;
  razorpay: InstitutionRazorpay;
  settings: InstitutionSettings;
  contactInfo: InstitutionContactInfo;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
