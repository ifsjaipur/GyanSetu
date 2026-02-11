"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface EnrollmentWithCourse {
  id: string;
  courseId: string;
  status: string;
  courseTitle?: string;
  courseThumbnailUrl?: string;
  courseType?: string;
  progress: {
    completedLessons: number;
    totalLessons: number;
    percentComplete: number;
    lastLessonId: string | null;
  };
}

export default function DashboardPage() {
  const { userData, loading: authLoading } = useAuth();
  const router = useRouter();
  const [enrollments, setEnrollments] = useState<EnrollmentWithCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const res = await fetch("/api/enrollments");
        if (res.ok) {
          const data = await res.json();
          const enrollList = data.enrollments || [];

          // Fetch course titles for each enrollment
          const withCourses = await Promise.all(
            enrollList.map(async (e: EnrollmentWithCourse) => {
              try {
                const courseRes = await fetch(`/api/courses/${e.courseId}`);
                if (courseRes.ok) {
                  const course = await courseRes.json();
                  return {
                    ...e,
                    courseTitle: course.title,
                    courseThumbnailUrl: course.thumbnailUrl,
                    courseType: course.type,
                  };
                }
              } catch {
                // ignore — course info not critical
              }
              return e;
            })
          );
          setEnrollments(withCourses);
        }
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) fetchDashboardData();
  }, [authLoading]);

  if (authLoading || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-[var(--muted-foreground)]">Loading...</div>
      </div>
    );
  }

  const activeEnrollments = enrollments.filter((e) => e.status === "active");
  const completedEnrollments = enrollments.filter((e) => e.status === "completed");
  const totalProgress = activeEnrollments.length > 0
    ? Math.round(
        activeEnrollments.reduce((sum, e) => sum + (e.progress?.percentComplete || 0), 0) /
          activeEnrollments.length
      )
    : 0;

  const isAdmin = userData?.role === "super_admin" || userData?.role === "institution_admin";

  return (
    <div>
      <h1 className="text-2xl font-bold">
        Welcome{userData?.displayName ? `, ${userData.displayName}` : ""}
      </h1>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        {userData?.role?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
      </p>

      {/* Summary cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardCard title="Enrolled Courses" value={String(activeEnrollments.length)} />
        <DashboardCard title="Completed" value={String(completedEnrollments.length)} />
        <DashboardCard title="Avg Progress" value={`${totalProgress}%`} />
        <DashboardCard title="Certificates" value="0" />
      </div>

      {/* Quick links for admin */}
      {isAdmin && (
        <div className="mt-6 flex gap-3 flex-wrap">
          <button
            onClick={() => router.push("/admin/courses")}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--muted)]"
          >
            Manage Courses
          </button>
          <button
            onClick={() => router.push("/admin/enrollments")}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--muted)]"
          >
            View Enrollments
          </button>
          <button
            onClick={() => router.push("/admin/users")}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--muted)]"
          >
            Manage Users
          </button>
        </div>
      )}

      {/* My Courses */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">My Courses</h2>
          <button
            onClick={() => router.push("/courses")}
            className="text-sm text-[var(--brand-primary)] hover:underline"
          >
            Browse all courses
          </button>
        </div>

        {activeEnrollments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-8 text-center">
            <p className="text-[var(--muted-foreground)]">
              You haven&apos;t enrolled in any courses yet.
            </p>
            <button
              onClick={() => router.push("/courses")}
              className="mt-3 rounded-lg px-4 py-2 text-sm text-white"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              Explore Courses
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeEnrollments.map((enrollment) => (
              <div
                key={enrollment.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push(`/courses/${enrollment.courseId}/learn`)}
              >
                {/* Thumbnail */}
                <div className="h-32 bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-secondary,var(--brand-primary))] flex items-center justify-center">
                  {enrollment.courseThumbnailUrl ? (
                    <img
                      src={enrollment.courseThumbnailUrl}
                      alt={enrollment.courseTitle || "Course"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-white/60 text-4xl">&#128218;</span>
                  )}
                </div>

                <div className="p-4">
                  <h3 className="font-semibold text-sm truncate">
                    {enrollment.courseTitle || "Untitled Course"}
                  </h3>
                  {enrollment.courseType && (
                    <span className="text-xs text-[var(--muted-foreground)] capitalize">
                      {enrollment.courseType.replace(/_/g, " ")}
                    </span>
                  )}

                  {/* Progress */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)] mb-1">
                      <span>
                        {enrollment.progress?.completedLessons || 0}/
                        {enrollment.progress?.totalLessons || 0} lessons
                      </span>
                      <span className="font-medium">
                        {enrollment.progress?.percentComplete || 0}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--muted)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--brand-primary)] transition-all"
                        style={{
                          width: `${enrollment.progress?.percentComplete || 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  <button
                    className="mt-3 w-full rounded-lg py-1.5 text-xs font-medium text-white"
                    style={{ backgroundColor: "var(--brand-primary)" }}
                  >
                    Continue Learning
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
        {title}
      </p>
      <p className="mt-2 text-2xl font-bold text-[var(--card-foreground)]">
        {value}
      </p>
    </div>
  );
}
