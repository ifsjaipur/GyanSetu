"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface EnrollmentForCert {
  id: string;
  userId: string;
  status: string;
  userName?: string;
  userEmail?: string;
  progress: {
    completedLessons: number;
    totalLessons: number;
    percentComplete: number;
  };
  attendanceCount: number;
  totalSessions: number;
  certificateId: string | null;
  certificateEligible: boolean;
}

export default function InstructorCertificatesPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [enrollments, setEnrollments] = useState<EnrollmentForCert[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/enrollments?courseId=${courseId}`);
        if (!res.ok) return;

        const data = await res.json();
        const enrollList = data.enrollments || [];

        // Fetch user details
        const withUsers = await Promise.all(
          enrollList.map(async (e: EnrollmentForCert) => {
            try {
              const userRes = await fetch(`/api/users?uid=${e.userId}`);
              if (userRes.ok) {
                const userData = await userRes.json();
                const users = userData.users || [];
                const user = users.find((u: { uid: string }) => u.uid === e.userId);
                if (user) {
                  return { ...e, userName: user.displayName, userEmail: user.email };
                }
              }
            } catch {
              // ignore
            }
            return e;
          })
        );

        setEnrollments(withUsers.filter((e: EnrollmentForCert) => e.status === "active" || e.status === "completed"));
      } catch (err) {
        console.error("Failed to fetch enrollments:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [courseId]);

  async function generateCertificate(enrollmentId: string) {
    setGenerating(enrollmentId);
    try {
      const res = await fetch("/api/certificates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Certificate generated: ${data.certificateId}`);
        // Refresh the list
        setEnrollments((prev) =>
          prev.map((e) =>
            e.id === enrollmentId
              ? { ...e, certificateId: data.certificateId, status: "completed" }
              : e
          )
        );
      } else {
        const data = await res.json();
        alert(data.error || "Failed to generate certificate");
      }
    } catch (err) {
      console.error("Certificate generation failed:", err);
      alert("Failed to generate certificate");
    } finally {
      setGenerating(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-[var(--muted-foreground)]">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Certificate Management</h1>
      <p className="text-sm text-[var(--muted-foreground)] mb-6">
        Generate certificates for students who have completed the course requirements.
      </p>

      {enrollments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
          <p className="text-[var(--muted-foreground)]">No enrollments found for this course.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                <th className="text-left py-2.5 px-4 font-medium">Student</th>
                <th className="text-center py-2.5 px-3 font-medium">Progress</th>
                <th className="text-center py-2.5 px-3 font-medium">Attendance</th>
                <th className="text-center py-2.5 px-3 font-medium">Status</th>
                <th className="text-right py-2.5 px-4 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((enroll) => {
                const progressPct = enroll.progress?.percentComplete || 0;
                const attendancePct =
                  enroll.totalSessions > 0
                    ? Math.round((enroll.attendanceCount / enroll.totalSessions) * 100)
                    : 0;
                const hasCert = !!enroll.certificateId;

                return (
                  <tr key={enroll.id} className="border-b border-[var(--border)]">
                    <td className="py-3 px-4">
                      <div className="font-medium">{enroll.userName || enroll.userId}</div>
                      <div className="text-xs text-[var(--muted-foreground)]">{enroll.userEmail}</div>
                    </td>
                    <td className="text-center py-3 px-3">
                      <span className={`text-xs font-medium ${progressPct === 100 ? "text-green-600" : ""}`}>
                        {progressPct}%
                      </span>
                    </td>
                    <td className="text-center py-3 px-3">
                      <span className="text-xs">
                        {enroll.attendanceCount}/{enroll.totalSessions}
                        {enroll.totalSessions > 0 && ` (${attendancePct}%)`}
                      </span>
                    </td>
                    <td className="text-center py-3 px-3">
                      {hasCert ? (
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                          Issued
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--muted-foreground)]">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="text-right py-3 px-4">
                      {hasCert ? (
                        <a
                          href={`/verify/${enroll.certificateId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[var(--brand-primary)] hover:underline"
                        >
                          View
                        </a>
                      ) : (
                        <button
                          onClick={() => generateCertificate(enroll.id)}
                          disabled={generating === enroll.id}
                          className="rounded-lg px-3 py-1 text-xs text-white disabled:opacity-50"
                          style={{ backgroundColor: "var(--brand-primary)" }}
                        >
                          {generating === enroll.id ? "Generating..." : "Generate"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
