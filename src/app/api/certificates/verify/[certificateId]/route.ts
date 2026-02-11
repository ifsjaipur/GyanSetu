import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";

/**
 * GET /api/certificates/verify/:certificateId
 * Public endpoint — no authentication required.
 * Returns certificate details for verification.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ certificateId: string }> }
) {
  try {
    const { certificateId } = await params;
    const db = getAdminDb();

    const certDoc = await db.collection("certificates").doc(certificateId).get();
    if (!certDoc.exists) {
      return NextResponse.json({ error: "Certificate not found", valid: false }, { status: 404 });
    }

    const cert = certDoc.data()!;

    if (cert.status === "revoked") {
      return NextResponse.json({
        valid: false,
        certificateId,
        status: "revoked",
        revokedReason: cert.revokedReason,
      });
    }

    return NextResponse.json({
      valid: true,
      certificateId,
      recipientName: cert.recipientName,
      courseName: cert.courseName,
      institutionName: cert.institutionName,
      issueDate: cert.issueDate,
      grade: cert.grade,
      finalScore: cert.finalScore,
      pdfUrl: cert.pdfUrl,
      status: cert.status,
    });
  } catch (err) {
    console.error("Certificate verification error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
