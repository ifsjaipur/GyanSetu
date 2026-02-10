/**
 * Public certificate verification page.
 * No authentication required — anyone can verify a certificate by its ID.
 */
export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ certificateId: string }>;
}) {
  const { certificateId } = await params;

  // Note: In production, this would use the admin SDK server-side
  // For now, show a placeholder
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--muted)]">
      <div className="w-full max-w-lg rounded-xl bg-[var(--card)] p-8 text-center shadow-lg">
        <h1 className="text-xl font-bold">Certificate Verification</h1>
        <p className="mt-4 text-[var(--muted-foreground)]">
          Certificate ID: <code className="font-mono">{certificateId}</code>
        </p>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          Verification system will be implemented in Phase 2.
        </p>
      </div>
    </main>
  );
}
