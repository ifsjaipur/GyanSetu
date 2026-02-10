"use client";

import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { usePathname } from "next/navigation";

const adminNav = [
  { href: "/admin/institutions", label: "Institutions" },
  { href: "/admin/courses", label: "Courses" },
  { href: "/admin/enrollments", label: "Enrollments" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/analytics", label: "Analytics" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userData, loading } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return <div className="text-[var(--muted-foreground)]">Loading...</div>;
  }

  const allowedRoles = ["super_admin", "institution_admin"];
  if (!userData || !allowedRoles.includes(userData.role)) {
    return (
      <div className="text-center text-[var(--muted-foreground)]">
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="mt-2">You do not have permission to view this page.</p>
      </div>
    );
  }

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
