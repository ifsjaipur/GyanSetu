"use client";

import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userData, firebaseUser, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const allowedRoles = ["super_admin", "institution_admin"];
  const hasAccess = userData && allowedRoles.includes(userData.role);

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!loading && !firebaseUser) {
      router.replace("/login");
    }
  }, [loading, firebaseUser, router]);

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="text-[var(--muted-foreground)]">Loading...</div>
      </div>
    );
  }

  if (!firebaseUser) {
    return null; // Will redirect via useEffect
  }

  if (!hasAccess) {
    return (
      <div className="text-center text-[var(--muted-foreground)]">
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="mt-2">You do not have permission to view this page.</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-4 rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--muted)]"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  const isSuperAdmin = userData.role === "super_admin";

  const adminNav = [
    { href: "/admin/courses", label: "Courses" },
    { href: "/admin/enrollments", label: "Enrollments" },
    { href: "/admin/payments", label: "Payments" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/analytics", label: "Analytics" },
    ...(isSuperAdmin
      ? [
          { href: "/admin/institutions", label: "Institutions" },
          { href: "/admin/reset-data", label: "Reset Data" },
        ]
      : []),
  ];

  return (
    <div>
      <div className="mb-6 flex items-center gap-1 overflow-x-auto border-b border-[var(--border)] pb-2">
        {adminNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${
              pathname.startsWith(item.href)
                ? "bg-[var(--brand-primary)] text-white"
                : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
