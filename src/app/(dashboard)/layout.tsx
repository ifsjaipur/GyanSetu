"use client";

import { useState } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { InstitutionProvider, useInstitution } from "@/contexts/InstitutionContext";
import { signOut } from "@/lib/firebase/auth";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { usePushNotifications } from "@/hooks/usePushNotifications";

function UserAvatar({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        className="h-8 w-8 rounded-full object-cover"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-primary)] text-xs font-semibold text-white">
      {initials || "?"}
    </div>
  );
}

function NotificationToggle() {
  const { isSupported, isSubscribed, permission, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) return null;

  return (
    <button
      onClick={isSubscribed ? unsubscribe : subscribe}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
        isSubscribed
          ? "text-[var(--brand-primary)] bg-blue-50"
          : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
      }`}
      title={isSubscribed ? "Notifications enabled" : "Enable notifications"}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {isSubscribed ? "Notifications on" : "Enable notifications"}
    </button>
  );
}

function Sidebar({ onClose }: { onClose?: () => void }) {
  const { userData, firebaseUser } = useAuth();
  const { institution } = useInstitution();
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
    ...(isAdmin ? [{ href: "/admin/courses", label: "Admin Panel" }] : []),
    ...(isAdmin ? [{ href: "/admin/zoom", label: "Zoom Meetings" }] : []),
  ];

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  const displayName = firebaseUser?.displayName || firebaseUser?.email || "";
  const photoUrl = firebaseUser?.photoURL || userData?.photoUrl;

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--card)]">
      {/* Logo / Institution Name */}
      <div className="p-4">
        {institution?.branding?.logoUrl ? (
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={institution.branding.logoUrl}
              alt={institution.name}
              className="h-8 w-auto"
            />
            <span className="font-bold text-sm text-[var(--brand-primary)]">
              {institution.name}
            </span>
          </div>
        ) : (
          <span className="font-bold text-lg text-[var(--brand-primary)]">
            {institution?.name || ""}
          </span>
        )}
      </div>

      <nav className="mt-2 flex-1 space-y-1 px-2">
        {navItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            onClick={onClose}
            className={`block rounded-lg px-3 py-2 text-sm transition ${
              pathname.startsWith(item.href)
                ? "bg-[var(--brand-primary)] text-white"
                : "text-[var(--foreground)] hover:bg-[var(--muted)]"
            }`}
          >
            {item.label}
          </a>
        ))}
        <div className="pt-2 border-t border-[var(--border)] mt-2">
          <NotificationToggle />
        </div>
      </nav>

      {/* User info + sign out */}
      <div className="border-t border-[var(--border)] p-3">
        {firebaseUser && (
          <div className="mb-2 flex items-center gap-2">
            <UserAvatar name={displayName} photoUrl={photoUrl} />
            <div className="flex-1 min-w-0">
              <div className="truncate text-sm font-medium">
                {displayName}
              </div>
              <div className="truncate text-xs text-[var(--muted-foreground)]">
                {userData?.role?.replace("_", " ") || "loading..."}
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Link
            href="/profile/edit"
            className="flex-1 rounded-lg px-3 py-1.5 text-center text-xs text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          >
            Edit Profile
          </Link>
          <button
            onClick={handleSignOut}
            className="flex-1 rounded-lg px-3 py-1.5 text-center text-xs text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function MobileHeader({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { institution } = useInstitution();

  return (
    <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)] p-3 lg:hidden">
      <button
        onClick={onOpenMenu}
        className="rounded-lg p-2 hover:bg-[var(--muted)]"
        aria-label="Open menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <span className="font-bold text-sm text-[var(--brand-primary)]">
        {institution?.name || ""}
      </span>
      <div className="w-8" />
    </div>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 lg:block">
        <Sidebar />
      </aside>

      {/* Mobile header */}
      <MobileHeader onOpenMenu={() => setMobileMenuOpen(true)} />

      {/* Mobile slide-out menu */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 lg:hidden">
            <Sidebar onClose={() => setMobileMenuOpen(false)} />
          </aside>
        </>
      )}

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl p-6">{children}</div>
      </main>
    </div>
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
        <DashboardShell>{children}</DashboardShell>
      </InstitutionProvider>
    </AuthProvider>
  );
}
