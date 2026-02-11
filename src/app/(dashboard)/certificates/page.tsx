"use client";

import { useEffect, useState } from "react";

interface Certificate {
  id: string;
  recipientName: string;
  courseName: string;
  institutionName: string;
  issueDate: unknown;
  pdfUrl: string;
  publicVerificationUrl: string;
  grade: string | null;
  finalScore: number | null;
  status: string;
}

function formatDate(val: unknown): string {
  if (!val) return "—";
  if (typeof val === "object" && val !== null && "_seconds" in val) {
    return new Date((val as { _seconds: number })._seconds * 1000).toLocaleDateString("en-IN", {
      day: "numeric", month: "long", year: "numeric",
    });
  }
  const d = new Date(val as string | number);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  });
}

export default function CertificatesPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCertificates() {
      try {
        const res = await fetch("/api/certificates");
        if (res.ok) {
          const data = await res.json();
          setCertificates(data.certificates || []);
        }
      } catch (err) {
        console.error("Failed to fetch certificates:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCertificates();
  }, []);

  function copyLink(url: string, certId: string) {
    navigator.clipboard.writeText(url);
    setCopied(certId);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-[var(--muted-foreground)]">Loading certificates...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">My Certificates</h1>
      <p className="mt-2 text-[var(--muted-foreground)]">
        Certificates you earn by completing courses.
      </p>

      {certificates.length === 0 ? (
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
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {certificates.map((cert) => (
            <div
              key={cert.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-sm">{cert.courseName}</h3>
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                    {cert.institutionName}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  cert.status === "issued"
                    ? "bg-green-100 text-green-700"
                    : cert.status === "revoked"
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-600"
                }`}>
                  {cert.status}
                </span>
              </div>

              <p className="text-xs text-[var(--muted-foreground)] mt-2">
                Issued: {formatDate(cert.issueDate)}
              </p>
              {cert.grade && (
                <p className="text-xs text-[var(--muted-foreground)]">Grade: {cert.grade}</p>
              )}

              <p className="text-xs font-mono text-[var(--muted-foreground)] mt-2">
                {cert.id}
              </p>

              <div className="mt-3 flex gap-2">
                <a
                  href={cert.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-center hover:bg-[var(--muted)]"
                >
                  Download PDF
                </a>
                <button
                  onClick={() => copyLink(cert.publicVerificationUrl, cert.id)}
                  className="flex-1 rounded-lg px-3 py-1.5 text-xs text-white text-center"
                  style={{ backgroundColor: "var(--brand-primary)" }}
                >
                  {copied === cert.id ? "Copied!" : "Share Link"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
