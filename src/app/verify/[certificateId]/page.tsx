import { getAdminDb } from "@/lib/firebase/admin";

/**
 * Public certificate verification page.
 * No authentication required — anyone can verify a certificate by its ID.
 * Server-side rendered for SEO and public sharing.
 */
export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ certificateId: string }>;
}) {
  const { certificateId } = await params;

  let cert: Record<string, unknown> | null = null;
  let error: string | null = null;

  try {
    const db = getAdminDb();
    const certDoc = await db.collection("certificates").doc(certificateId).get();

    if (certDoc.exists) {
      cert = certDoc.data() as Record<string, unknown>;
    } else {
      error = "Certificate not found";
    }
  } catch {
    error = "Unable to verify certificate";
  }

  function formatDate(val: unknown): string {
    if (!val) return "";
    if (typeof val === "object" && val !== null && "_seconds" in val) {
      return new Date((val as { _seconds: number })._seconds * 1000).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
    return "";
  }

  if (error || !cert) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f5]">
        <div className="w-full max-w-lg rounded-xl bg-white p-8 text-center shadow-lg">
          <div className="text-5xl mb-4">&#10060;</div>
          <h1 className="text-xl font-bold text-gray-900">Certificate Not Found</h1>
          <p className="mt-2 text-gray-600">
            The certificate ID <code className="font-mono bg-gray-100 px-2 py-0.5 rounded">{certificateId}</code> could not be verified.
          </p>
          <p className="mt-4 text-sm text-gray-500">
            Please check the ID and try again. If you believe this is an error,
            contact the issuing institution.
          </p>
        </div>
      </main>
    );
  }

  const isRevoked = cert.status === "revoked";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f5f5] p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-lg overflow-hidden">
        {/* Header */}
        <div className={`px-8 py-6 text-center text-white ${isRevoked ? "bg-red-600" : "bg-green-600"}`}>
          <div className="text-4xl mb-2">{isRevoked ? "&#9888;" : "&#10003;"}</div>
          <h1 className="text-xl font-bold">
            {isRevoked ? "Certificate Revoked" : "Certificate Verified"}
          </h1>
        </div>

        {/* Details */}
        <div className="px-8 py-6 space-y-4">
          {isRevoked && cert.revokedReason ? (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              Reason: {String(cert.revokedReason)}
            </div>
          ) : null}

          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Recipient</p>
            <p className="text-lg font-semibold text-gray-900">{String(cert.recipientName)}</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Course</p>
            <p className="text-lg font-semibold text-gray-900">{String(cert.courseName)}</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Issued By</p>
            <p className="font-medium text-gray-900">{String(cert.institutionName)}</p>
          </div>

          <div className="flex gap-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Issue Date</p>
              <p className="font-medium text-gray-900">{formatDate(cert.issueDate)}</p>
            </div>
            {cert.grade ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Grade</p>
                <p className="font-medium text-gray-900">{String(cert.grade)}</p>
              </div>
            ) : null}
            {cert.finalScore != null ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Score</p>
                <p className="font-medium text-gray-900">{String(cert.finalScore)}</p>
              </div>
            ) : null}
          </div>

          <div className="border-t border-gray-200 pt-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Certificate ID</p>
            <p className="font-mono text-sm text-gray-600">{certificateId}</p>
          </div>

          {cert.pdfUrl && !isRevoked ? (
            <a
              href={String(cert.pdfUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded-lg bg-blue-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-700"
            >
              View Certificate PDF
            </a>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-8 py-4 text-center text-xs text-gray-500">
          Verified by GyanSetu Education Platform
        </div>
      </div>
    </main>
  );
}
