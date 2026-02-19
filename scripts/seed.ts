/**
 * Seed script for live Firestore
 *
 * Usage: npx tsx scripts/seed.ts
 *
 * Seeds Firestore with:
 * - 1 example institution
 * - 2 courses (1 free, 1 paid)
 * - 1 module with 2 lessons
 */

import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local
const envPath = resolve(__dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx);
  let value = trimmed.slice(eqIdx + 1);
  // Remove surrounding quotes
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  process.env[key] = value;
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing Firebase Admin credentials in .env.local");
  process.exit(1);
}

const serviceAccount: ServiceAccount = {
  projectId,
  clientEmail,
  privateKey,
};

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function seed() {
  console.log("Seeding Firestore...\n");

  // 1. Create institution
  const institutionId = process.env.NEXT_PUBLIC_DEFAULT_INSTITUTION_ID || "demo";
  console.log(`Creating institution: ${institutionId}`);
  await db.collection("institutions").doc(institutionId).set({
    id: institutionId,
    name: "Example Institution",
    slug: institutionId,
    domains: ["localhost"],
    primaryDomain: "localhost",
    allowedEmailDomains: ["gmail.com"],
    branding: {
      logoUrl: "",
      faviconUrl: "",
      primaryColor: "#1E40AF",
      secondaryColor: "#1E3A5F",
      accentColor: "#F59E0B",
      headerBgColor: "#FFFFFF",
      footerText: "Example Institution",
      institutionTagline: "Empowering Education",
    },
    razorpay: {
      keyId: process.env.RAZORPAY_KEY_ID || "",
      keySecretRef: process.env.RAZORPAY_KEY_SECRET || "",
      webhookSecretRef: process.env.RAZORPAY_WEBHOOK_SECRET || "",
    },
    settings: {
      defaultCourseAccessDays: 90,
      certificateTemplateDocId: "",
      certificateFolderId: "",
      videoStorageBucket: "",
      enableSelfRegistration: true,
      allowExternalUsers: true,
      requireEmailVerification: false,
      maintenanceMode: false,
    },
    contactInfo: {
      supportEmail: "support@example.com",
      phone: "",
      address: "",
      website: "https://example.com",
    },
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log("  Done: Institution created\n");

  // 2. Create a free course
  const courseId = "getting-started";
  console.log(`Creating course: ${courseId}`);
  await db.collection("courses").doc(courseId).set({
    id: courseId,
    institutionId,
    title: "Getting Started",
    slug: "getting-started",
    description:
      "A sample course to help you explore the platform. This course demonstrates modules, lessons, and progress tracking.",
    shortDescription: "Explore the platform with this sample course",
    thumbnailUrl: "",
    type: "self_paced",
    skillLevel: "beginner",
    language: "en",
    pricing: {
      amount: 0,
      currency: "INR",
      originalAmount: null,
      isFree: true,
    },
    selfPacedConfig: {
      accessDurationDays: 90,
      estimatedHours: 10,
    },
    bootcampConfig: null,
    instructorLedConfig: null,
    classroomCourseId: null,
    classroomInviteLink: null,
    instructorIds: [],
    tags: ["sample", "getting-started", "beginner"],
    prerequisites: [],
    moduleOrder: ["module-1"],
    status: "published",
    isVisible: true,
    enrollmentCount: 0,
    createdBy: "seed-script",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log("  Done: Free course created\n");

  // 3. Create a module
  const moduleId = "module-1";
  console.log(`Creating module: ${moduleId}`);
  await db
    .collection("courses")
    .doc(courseId)
    .collection("modules")
    .doc(moduleId)
    .set({
      id: moduleId,
      courseId,
      title: "Module 1: Introduction",
      description: "An overview of the platform and its features",
      order: 0,
      lessonOrder: ["lesson-1", "lesson-2"],
      isPublished: true,
      unlockAfterModuleId: null,
    });
  console.log("  Done: Module created\n");

  // 4. Create lessons
  console.log("Creating lessons...");
  await db
    .collection("courses")
    .doc(courseId)
    .collection("modules")
    .doc(moduleId)
    .collection("lessons")
    .doc("lesson-1")
    .set({
      id: "lesson-1",
      type: "text",
      title: "Welcome to the Platform",
      order: 0,
      videoConfig: null,
      textContent:
        "Welcome to the learning platform! This lesson demonstrates how text-based lessons work.\n\n## Features\n\n1. **Course Management** - Create and organize courses with modules and lessons\n2. **Video Learning** - Embed YouTube or Google Drive videos with progress tracking\n3. **Live Classes** - Schedule sessions with Google Meet or Zoom\n4. **Certificates** - Auto-generate certificates on completion\n5. **Payments** - Accept payments via Razorpay",
      resources: [],
      assignmentConfig: null,
      isPublished: true,
      estimatedMinutes: 15,
    });

  await db
    .collection("courses")
    .doc(courseId)
    .collection("modules")
    .doc(moduleId)
    .collection("lessons")
    .doc("lesson-2")
    .set({
      id: "lesson-2",
      type: "text",
      title: "Managing Your Courses",
      order: 1,
      videoConfig: null,
      textContent:
        "As an instructor or admin, you can create and manage courses from the dashboard.\n\n## Course Types\n\n- **Self-Paced** - Students learn at their own speed\n- **Bootcamp** - Time-bound with scheduled sessions\n- **Instructor-Led** - Requires approved membership in the institution\n\n## Getting Started\n\n1. Navigate to the Admin or Instructor panel\n2. Create a new course with title, description, and pricing\n3. Add modules and lessons\n4. Publish the course",
      resources: [],
      assignmentConfig: null,
      isPublished: true,
      estimatedMinutes: 20,
    });
  console.log("  Done: 2 lessons created\n");

  // 5. Create a paid course
  const paidCourseId = "sample-paid-course";
  console.log(`Creating paid course: ${paidCourseId}`);
  await db.collection("courses").doc(paidCourseId).set({
    id: paidCourseId,
    institutionId,
    title: "Sample Paid Course",
    slug: "sample-paid-course",
    description:
      "This is a sample paid course to demonstrate the payment and enrollment flow. Replace with your own content.",
    shortDescription: "A sample course with payment integration",
    thumbnailUrl: "",
    type: "self_paced",
    skillLevel: "advanced",
    language: "en",
    pricing: {
      amount: 99900,
      currency: "INR",
      originalAmount: 199900,
      isFree: false,
    },
    selfPacedConfig: {
      accessDurationDays: 180,
      estimatedHours: 30,
    },
    bootcampConfig: null,
    instructorLedConfig: null,
    classroomCourseId: null,
    classroomInviteLink: null,
    instructorIds: [],
    tags: ["sample", "paid", "demo"],
    prerequisites: ["getting-started"],
    moduleOrder: [],
    status: "published",
    isVisible: true,
    enrollmentCount: 0,
    createdBy: "seed-script",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log("  Done: Paid course created\n");

  console.log("========================================");
  console.log("Seed complete!");
  console.log("");
  console.log(`Institution: Example Institution (${institutionId})`);
  console.log("Courses:");
  console.log("  - Getting Started (free)");
  console.log("  - Sample Paid Course (Rs.999)");
  console.log("");
  console.log("Next: run 'npm run dev' and open http://localhost:3000");
  console.log("========================================");

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
