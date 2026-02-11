"use client";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { InstitutionProvider } from "@/contexts/InstitutionContext";
import { signOut } from "@/lib/firebase/auth";
import { useRouter, usePathname } from "next/navigation";

function Sidebar() {
  const { userData, firebaseUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isAdmin =
    userData?.role === "super_admin" ||
    userData?.role === "institution_admin";

  const isInstructorOrAbove =
    isAdmin || userData?.role === "instructor";

  const navItems = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/courses", label: "Courses" },
    { href: "/certificates", label: "Certificates" },
    ...(isInstructorOrAbove
      ? [{ href: "/instructor/courses", label: "Instructor" }]
      : []),
    ...(isAdmin ? [{ href: "/admin/institutions", label: "Admin Panel" }] : []),
  ];

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--card)] lg:flex">
      <div className="p-4 font-bold text-lg text-[var(--brand-primary)]">
        GyanSetu
      </div>

      <nav className="mt-2 flex-1 space-y-1 px-2">
        {navItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className={`block rounded-lg px-3 py-2 text-sm transition ${
              pathname.startsWith(item.href)
                ? "bg-[var(--brand-primary)] text-white"
                : "text-[var(--foreground)] hover:bg-[var(--muted)]"
            }`}
          >
            {item.label}
          </a>
        ))}
      </nav>

      {/* User info + sign out */}
      <div className="border-t border-[var(--border)] p-3">
        {firebaseUser && (
          <div className="mb-2">
            <div className="truncate text-sm font-medium">
              {firebaseUser.displayName || firebaseUser.email}
            </div>
            <div className="truncate text-xs text-[var(--muted-foreground)]">
              {userData?.role?.replace("_", " ") || "loading..."}
            </div>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="w-full rounded-lg px-3 py-1.5 text-left text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <InstitutionProvider>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-7xl p-6">{children}</div>
          </main>
        </div>
      </InstitutionProvider>
    </AuthProvider>
  );
}
