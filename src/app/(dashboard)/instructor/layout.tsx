"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userData, firebaseUser, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [courseTitle, setCourseTitle] = useState<string | null>(null);

  // Extract courseId from pathname for sub-nav
  const courseMatch = pathname.match(/\/instructor\/courses\/([^/]+)/);
  const courseId = courseMatch?.[1];

  const allowedRoles = ["super_admin", "institution_admin", "instructor"];
  const hasAccess = userData && allowedRoles.includes(userData.role);

  useEffect(() => {
    if (!courseId) {
      setCourseTitle(null);
      return;
    }
    async function fetchCourse() {
      try {
        const res = await fetch(`/api/courses/${courseId}`);
        if (res.ok) {
          const data = await res.json();
          setCourseTitle(data.title || null);
        }
      } catch {
        // ignore
      }
    }
    fetchCourse();
  }, [courseId]);

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

  const courseNav = courseId
    ? [
        { href: `/instructor/courses/${courseId}/modules`, label: "Content" },
        { href: `/instructor/courses/${courseId}/sessions`, label: "Sessions" },
        { href: `/instructor/courses/${courseId}/attendance`, label: "Attendance" },
        { href: `/instructor/courses/${courseId}/exams`, label: "Exams" },
        { href: `/instructor/courses/${courseId}/certificates`, label: "Certificates" },
      ]
    : [];

  return (
    <div>
      <div className="mb-4">
        {courseId ? (
          <div>
            <Link
              href="/instructor/courses"
              className="text-sm text-[var(--muted-foreground)] hover:underline"
            >
              &larr; My Courses
            </Link>
            <h2 className="text-lg font-bold mt-1">
              {courseTitle || "Loading..."}
            </h2>
          </div>
        ) : (
          <h2 className="text-lg font-bold">Instructor Panel</h2>
        )}
      </div>

      {courseNav.length > 0 && (
        <div className="mb-6 flex items-center gap-1 overflow-x-auto border-b border-[var(--border)] pb-2">
          {courseNav.map((item) => (
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
      )}

      {children}
    </div>
  );
}
