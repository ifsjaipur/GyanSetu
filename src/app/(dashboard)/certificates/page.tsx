"use client";

export default function CertificatesPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">My Certificates</h1>
      <p className="mt-2 text-[var(--muted-foreground)]">
        Certificates you earn by completing courses will appear here.
      </p>

      <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] p-12 text-center">
        <div className="text-4xl opacity-30">&#127891;</div>
        <p className="mt-4 text-[var(--muted-foreground)]">
          No certificates yet. Complete a course to earn your first certificate.
        </p>
        <a
          href="/courses"
          className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: "var(--brand-primary)" }}
        >
          Browse Courses
        </a>
      </div>
    </div>
  );
}
