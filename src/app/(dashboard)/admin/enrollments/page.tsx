"use client";

import { useEffect, useState } from "react";

interface EnrollmentItem {
  id: string;
  userId: string;
  courseId: string;
  status: string;
  enrolledAt: string;
  progress: {
    percentComplete: number;
    completedLessons: number;
    totalLessons: number;
  };
  // Populated from join
  userName?: string;
  userEmail?: string;
  courseTitle?: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  pending_payment: "bg-yellow-100 text-yellow-700",
  expired: "bg-red-100 text-red-700",
  completed: "bg-blue-100 text-blue-700",
  cancelled: "bg-gray-100 text-gray-600",
  refunded: "bg-orange-100 text-orange-700",
};

export default function AdminEnrollmentsPage() {
  const [enrollments, setEnrollments] = useState<EnrollmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEnrollments() {
      try {
        const res = await fetch("/api/enrollments");
        if (res.ok) {
          const data = await res.json();
          setEnrollments(data.enrollments);
        }
      } catch (err) {
        console.error("Failed to fetch enrollments:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchEnrollments();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">Enrollments</h1>

      <div className="mt-2 text-sm text-[var(--muted-foreground)]">
        {enrollments.length} total &middot;{" "}
        {enrollments.filter((e) => e.status === "active").length} active
      </div>

      {loading ? (
        <div className="mt-8 text-[var(--muted-foreground)]">Loading...</div>
      ) : enrollments.length === 0 ? (
        <div className="mt-8 text-center text-[var(--muted-foreground)]">
          No enrollments found.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                <th className="pb-3 pr-4 font-medium">Student</th>
                <th className="pb-3 pr-4 font-medium">Course</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 pr-4 font-medium">Progress</th>
                <th className="pb-3 font-medium">Enrolled</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((enrollment) => (
                <tr
                  key={enrollment.id}
                  className="border-b border-[var(--border)]"
                >
                  <td className="py-3 pr-4">
                    <div className="font-medium">
                      {enrollment.userName || enrollment.userId}
                    </div>
                    {enrollment.userEmail && (
                      <div className="text-xs text-[var(--muted-foreground)]">
                        {enrollment.userEmail}
                      </div>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {enrollment.courseTitle || enrollment.courseId}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_COLORS[enrollment.status] || ""
                      }`}
                    >
                      {enrollment.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 rounded-full bg-[var(--muted)]">
                        <div
                          className="h-2 rounded-full bg-[var(--brand-primary)]"
                          style={{
                            width: `${enrollment.progress?.percentComplete || 0}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {enrollment.progress?.percentComplete || 0}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 text-xs text-[var(--muted-foreground)]">
                    {enrollment.enrolledAt
                      ? new Date(enrollment.enrolledAt).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
