/**
 * Seed script for Firebase Emulator
 *
 * Usage: npx tsx scripts/seed-emulator.ts
 *
 * Seeds the Firestore emulator with:
 * - 1 test institution (IFS)
 * - 1 test course (self-paced)
 * - 1 module with 2 lessons
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// Point to emulator
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

const app = initializeApp({
  projectId: "gyansetu-5ac34",
});

const db = getFirestore(app);
const auth = getAuth(app);

async function seed() {
  console.log("🌱 Seeding Firestore emulator...\n");

  // 1. Create institution
  const institutionId = "ifs";
  console.log(`Creating institution: ${institutionId}`);
  await db.collection("institutions").doc(institutionId).set({
    id: institutionId,
    name: "Institute of Financial Studies",
    slug: "ifs",
    domains: ["learn.ifs.edu.in", "localhost"],
    primaryDomain: "localhost",
    allowedEmailDomains: ["ifs.edu.in"],
    branding: {
      logoUrl: "",
      faviconUrl: "",
      primaryColor: "#1E40AF",
      secondaryColor: "#1E3A5F",
      accentColor: "#F59E0B",
      headerBgColor: "#FFFFFF",
      footerText: "© 2026 Institute of Financial Studies",
      institutionTagline: "Empowering Financial Education",
    },
    googleWorkspace: {
      customerDomain: "",
      adminEmail: "",
      serviceAccountKeyRef: "",
      classroomTeacherEmail: "",
    },
    razorpay: {
      keyId: "",
      keySecretRef: "",
      webhookSecretRef: "",
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
      supportEmail: "support@ifs.edu.in",
      phone: "9876543210",
      address: "Mumbai, India",
      website: "https://ifs.edu.in",
    },
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log("  ✓ Institution created\n");

  // 2. Create a sample course
  const courseId = "intro-financial-markets";
  console.log(`Creating course: ${courseId}`);
  await db.collection("courses").doc(courseId).set({
    id: courseId,
    institutionId,
    title: "Introduction to Financial Markets",
    slug: "intro-financial-markets",
    description:
      "A comprehensive introduction to financial markets, covering stocks, bonds, derivatives, and market microstructure. Perfect for beginners looking to understand how markets work.",
    shortDescription: "Learn the fundamentals of financial markets and trading",
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
    tags: ["finance", "markets", "beginner", "stocks"],
    prerequisites: [],
    moduleOrder: ["module-1"],
    status: "published",
    isVisible: true,
    enrollmentCount: 0,
    createdBy: "seed-script",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log("  ✓ Course created\n");

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
      title: "Module 1: What Are Financial Markets?",
      description: "An overview of different types of financial markets",
      order: 0,
      lessonOrder: ["lesson-1", "lesson-2"],
      isPublished: true,
      unlockAfterModuleId: null,
    });
  console.log("  ✓ Module created\n");

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
      title: "Introduction to Markets",
      order: 0,
      videoConfig: null,
      textContent:
        "Financial markets are platforms where buyers and sellers trade financial instruments such as stocks, bonds, currencies, and derivatives. These markets play a crucial role in the economy by facilitating capital allocation, price discovery, and risk management.\n\n## Types of Financial Markets\n\n1. **Stock Markets** — Where shares of public companies are traded\n2. **Bond Markets** — Where debt securities are bought and sold\n3. **Forex Markets** — The largest market by volume, trading currencies\n4. **Derivatives Markets** — Futures, options, and swaps\n5. **Commodity Markets** — Trading physical goods like gold, oil, wheat",
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
      title: "How Stock Markets Work",
      order: 1,
      videoConfig: null,
      textContent:
        "Stock markets enable companies to raise capital by issuing shares to the public, and allow investors to buy and sell those shares.\n\n## Key Concepts\n\n- **IPO (Initial Public Offering)** — When a company first offers shares to the public\n- **Market Makers** — Firms that provide liquidity by quoting buy and sell prices\n- **Exchanges** — Organized platforms like NSE, BSE where trades happen\n- **Market Indices** — Benchmarks like NIFTY 50, SENSEX that track market performance\n\n## Indian Stock Markets\n\nIndia has two major stock exchanges:\n- **NSE (National Stock Exchange)** — Largest by volume\n- **BSE (Bombay Stock Exchange)** — Asia's oldest exchange",
      resources: [],
      assignmentConfig: null,
      isPublished: true,
      estimatedMinutes: 20,
    });
  console.log("  ✓ 2 lessons created\n");

  // 5. Create a paid course too
  const paidCourseId = "advanced-trading-strategies";
  console.log(`Creating paid course: ${paidCourseId}`);
  await db.collection("courses").doc(paidCourseId).set({
    id: paidCourseId,
    institutionId,
    title: "Advanced Trading Strategies",
    slug: "advanced-trading-strategies",
    description:
      "Master advanced trading techniques including technical analysis, algorithmic trading basics, risk management, and portfolio optimization strategies.",
    shortDescription: "Advanced trading techniques for serious investors",
    thumbnailUrl: "",
    type: "self_paced",
    skillLevel: "advanced",
    language: "en",
    pricing: {
      amount: 99900, // ₹999
      currency: "INR",
      originalAmount: 199900, // ₹1999
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
    tags: ["trading", "advanced", "technical-analysis", "algo-trading"],
    prerequisites: ["intro-financial-markets"],
    moduleOrder: [],
    status: "published",
    isVisible: true,
    enrollmentCount: 0,
    createdBy: "seed-script",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log("  ✓ Paid course created\n");

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ Seed complete!");
  console.log("");
  console.log("Institution: Institute of Financial Studies (ifs)");
  console.log("Courses:");
  console.log("  - Introduction to Financial Markets (free, published)");
  console.log("  - Advanced Trading Strategies (₹999, published)");
  console.log("");
  console.log("Next steps:");
  console.log("  1. Start Next.js: npm run dev");
  console.log("  2. Open http://localhost:3000/login");
  console.log("  3. Sign in with Google");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

seed().catch(console.error);
