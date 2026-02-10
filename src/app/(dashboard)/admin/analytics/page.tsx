"use client";

import { useEffect, useState } from "react";

interface AnalyticsData {
  totalUsers: number;
  totalCourses: number;
  totalEnrollments: number;
  totalRevenue: number;
  activeEnrollments: number;
  externalUsers: number;
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        // Aggregate from existing endpoints
        const [usersRes, coursesRes, enrollmentsRes, paymentsRes] =
          await Promise.all([
            fetch("/api/users"),
            fetch("/api/courses"),
            fetch("/api/enrollments"),
            fetch("/api/payments"),
          ]);

        const users = usersRes.ok ? (await usersRes.json()).users || [] : [];
        const courses = coursesRes.ok ? (await coursesRes.json()).courses || [] : [];
        const enrollments = enrollmentsRes.ok
          ? (await enrollmentsRes.json()).enrollments || []
          : [];
        const payments = paymentsRes.ok
          ? (await paymentsRes.json()).payments || []
          : [];

        setData({
          totalUsers: users.length,
          totalCourses: courses.length,
          totalEnrollments: enrollments.length,
          activeEnrollments: enrollments.filter(
            (e: { status: string }) => e.status === "active"
          ).length,
          totalRevenue:
            payments
              .filter((p: { status: string }) => p.status === "captured")
              .reduce((sum: number, p: { amount: number }) => sum + p.amount, 0) / 100,
          externalUsers: users.filter((u: { isExternal: boolean }) => u.isExternal).length,
        });
      } catch (err) {
        console.error("Failed to load analytics:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, []);

  if (loading) {
    return <div className="text-[var(--muted-foreground)]">Loading analytics...</div>;
  }

  if (!data) {
    return <div className="text-[var(--muted-foreground)]">Failed to load analytics.</div>;
  }

  const cards = [
    { label: "Total Users", value: data.totalUsers, color: "bg-blue-50 text-blue-700" },
    { label: "External Users", value: data.externalUsers, color: "bg-orange-50 text-orange-700" },
    { label: "Total Courses", value: data.totalCourses, color: "bg-purple-50 text-purple-700" },
    { label: "Active Enrollments", value: data.activeEnrollments, color: "bg-green-50 text-green-700" },
    { label: "Total Enrollments", value: data.totalEnrollments, color: "bg-gray-50 text-gray-700" },
    {
      label: "Revenue",
      value: `₹${data.totalRevenue.toLocaleString("en-IN")}`,
      color: "bg-emerald-50 text-emerald-700",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold">Analytics</h1>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Overview of your institution&apos;s performance
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`rounded-lg p-5 ${card.color}`}
          >
            <div className="text-sm font-medium opacity-80">{card.label}</div>
            <div className="mt-1 text-2xl font-bold">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-lg border border-[var(--border)] p-6 text-center text-sm text-[var(--muted-foreground)]">
        Detailed charts and time-series analytics will be available in Phase 5.
      </div>
    </div>
  );
}
