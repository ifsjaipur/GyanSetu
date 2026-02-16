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
  locale: string; // e.g. "en", "hi", "kn", "mr"
}

export interface InstitutionWhatsApp {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
}

export interface InstitutionZoom {
  accountId: string;
  clientId: string;
  clientSecretRef: string;
  webhookSecretToken: string;
  defaultUserId: string;
  isEnabled: boolean;
}

export interface InstitutionContactInfo {
  supportEmail: string;
  phone: string;
  address: string;
  website: string;
}

export interface InstitutionLocation {
  country: string;
  state: string;
  city: string;
  lat: number | null;
  lng: number | null;
  timezone: string; // e.g. "Asia/Kolkata"
}

export interface Institution {
  id: string;
  name: string;
  slug: string;
  allowedEmailDomains: string[];
  inviteCode: string;
  location: InstitutionLocation | null;
  branding: InstitutionBranding;
  googleWorkspace: InstitutionGoogleWorkspace;
  razorpay: InstitutionRazorpay;
  whatsapp: InstitutionWhatsApp | null;
  zoom: InstitutionZoom | null;
  settings: InstitutionSettings;
  contactInfo: InstitutionContactInfo;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
