import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCallerContext } from "@/lib/auth/get-caller-context";
import { FieldValue } from "firebase-admin/firestore";
import { copyDriveFile, exportAsPdf, uploadToDrive, setPublicViewAccess } from "@/lib/google/drive";
import { mergeDocTemplate } from "@/lib/google/docs";
import { writeAuditLog } from "@/lib/audit-log";

/**
 * POST /api/certificates/generate
 * Generate a certificate for a student enrollment.
 * Instructor/Admin only.
 *
 * Body: { enrollmentId, grade?, finalScore? }
 */
export async function POST(request: NextRequest) {
  try {
    const caller = await getCallerContext(request.cookies.get("__session")?.value);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const allowedRoles = ["super_admin", "institution_admin", "instructor"];
    if (!allowedRoles.includes(caller.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getAdminDb();
    const body = await request.json();
    const { enrollmentId, grade, finalScore } = body;

    if (!enrollmentId) {
      return NextResponse.json({ error: "Missing enrollmentId" }, { status: 400 });
    }

    // Fetch enrollment
    const enrollDoc = await db.collection("enrollments").doc(enrollmentId).get();
    if (!enrollDoc.exists) {
      return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
    }

    const enrollment = enrollDoc.data()!;
    if (caller.role !== "super_admin" && enrollment.institutionId !== caller.institutionId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if certificate already exists
    if (enrollment.certificateId) {
      return NextResponse.json(
        { error: "Certificate already generated", certificateId: enrollment.certificateId },
        { status: 409 }
      );
    }

    // Fetch user, course, institution
    const [userDoc, courseDoc, instDoc] = await Promise.all([
      db.collection("users").doc(enrollment.userId).get(),
      db.collection("courses").doc(enrollment.courseId).get(),
      db.collection("institutions").doc(enrollment.institutionId).get(),
    ]);

    if (!userDoc.exists || !courseDoc.exists || !instDoc.exists) {
      return NextResponse.json({ error: "Related data not found" }, { status: 404 });
    }

    const user = userDoc.data()!;
    const course = courseDoc.data()!;
    const institution = instDoc.data()!;

    const templateDocId = institution.settings?.certificateTemplateDocId;
    const certFolderId = institution.settings?.certificateFolderId;

    if (!templateDocId) {
      return NextResponse.json(
        { error: "Certificate template not configured for this institution" },
        { status: 500 }
      );
    }

    // Generate certificate ID
    const instSlug = (institution.slug || institution.id || "GS").toUpperCase();
    const year = new Date().getFullYear();
    const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
    const certificateId = `CERT-${instSlug}-${year}-${randomPart}`;

    const issueDate = new Date();
    const issueDateStr = issueDate.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Step 1: Copy template
    const copiedDoc = await copyDriveFile(
      templateDocId,
      `Certificate - ${user.displayName} - ${course.title}`,
      certFolderId || undefined
    );

    const newDocId = copiedDoc.id!;

    // Step 2: Merge template fields
    await mergeDocTemplate(newDocId, {
      STUDENT_NAME: user.displayName || user.email,
      COURSE_NAME: course.title,
      INSTITUTION_NAME: institution.name,
      ISSUE_DATE: issueDateStr,
      CERTIFICATE_ID: certificateId,
      SCORE: finalScore != null ? String(finalScore) : "",
      GRADE: grade || "",
    });

    // Step 3: Export as PDF
    const pdfBuffer = await exportAsPdf(newDocId);

    // Step 4: Upload PDF to Drive
    const pdfFile = await uploadToDrive({
      name: `${certificateId}.pdf`,
      mimeType: "application/pdf",
      content: Buffer.from(pdfBuffer),
      folderId: certFolderId || undefined,
    });

    // Step 5: Make PDF publicly accessible
    await setPublicViewAccess(pdfFile.id!);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const publicVerificationUrl = `${appUrl}/verify/${certificateId}`;
    const pdfUrl = `https://drive.google.com/file/d/${pdfFile.id}/view`;

    // Step 6: Save certificate document
    const certRef = db.collection("certificates").doc(certificateId);
    await certRef.set({
      id: certificateId,
      userId: enrollment.userId,
      courseId: enrollment.courseId,
      institutionId: enrollment.institutionId,
      enrollmentId,
      recipientName: user.displayName || user.email,
      courseName: course.title,
      institutionName: institution.name,
      issueDate: FieldValue.serverTimestamp(),
      expiryDate: null,
      googleDocId: newDocId,
      pdfDriveFileId: pdfFile.id!,
      pdfUrl,
      publicVerificationUrl,
      templateDocId,
      grade: grade || null,
      finalScore: finalScore ?? null,
      status: "issued",
      revokedReason: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Step 7: Update enrollment with certificate
    await db.collection("enrollments").doc(enrollmentId).update({
      certificateId,
      certificateEligible: true,
      status: "completed",
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    writeAuditLog({
      institutionId: enrollment.institutionId,
      userId: caller.uid,
      userEmail: caller.email,
      userRole: caller.role,
      action: "certificate.generate",
      resource: "certificate",
      resourceId: certificateId,
      details: { enrollmentId, studentName: user.displayName, courseName: course.title, grade, finalScore },
    }, request);

    return NextResponse.json({
      certificateId,
      pdfUrl,
      publicVerificationUrl,
    });
  } catch (err) {
    console.error("Certificate generation failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
