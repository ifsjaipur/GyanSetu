"use client";

import { useAuth } from "@/contexts/AuthContext";

export default function DashboardPage() {
  const { userData, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-[var(--muted-foreground)]">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">
        Welcome{userData?.displayName ? `, ${userData.displayName}` : ""}
      </h1>
      <p className="mt-2 text-[var(--muted-foreground)]">
        Role: {userData?.role || "Unknown"} | Institution:{" "}
        {userData?.institutionId || "Unknown"}
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardCard title="My Courses" value="—" />
        <DashboardCard title="Certificates" value="—" />
        <DashboardCard title="Progress" value="—" />
      </div>
    </div>
  );
}

function DashboardCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
      <p className="text-sm text-[var(--muted-foreground)]">{title}</p>
      <p className="mt-2 text-3xl font-bold text-[var(--card-foreground)]">
        {value}
      </p>
    </div>
  );
}
