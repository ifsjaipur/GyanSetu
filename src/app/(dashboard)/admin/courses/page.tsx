"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface CourseItem {
  id: string;
  title: string;
  slug: string;
  type: string;
  status: string;
  enrollmentCount: number;
  pricing: { amount: number; isFree: boolean; currency: string };
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-700",
  published: "bg-green-100 text-green-700",
  archived: "bg-gray-100 text-gray-600",
};

const TYPE_LABELS: Record<string, string> = {
  bootcamp: "Bootcamp",
  instructor_led: "Instructor Led",
  self_paced: "Self Paced",
};

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    async function fetchCourses() {
      try {
        const res = await fetch("/api/courses", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setCourses(data.courses);
        }
      } catch (err) {
        console.error("Failed to fetch courses:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchCourses();
  }, []);

  const filtered =
    statusFilter === "all"
      ? courses
      : courses.filter((c) => c.status === statusFilter);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Courses</h1>
        <Link
          href="/admin/courses/new"
          className="rounded-lg px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: "var(--brand-primary)" }}
        >
          + New Course
        </Link>
      </div>

      {/* Filters */}
      <div className="mt-4 flex gap-2">
        {["all", "draft", "published", "archived"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-sm capitalize ${
              statusFilter === s
                ? "bg-[var(--brand-primary)] text-white"
                : "bg-[var(--muted)] text-[var(--muted-foreground)]"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-8 text-[var(--muted-foreground)]">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 text-center text-[var(--muted-foreground)]">
          No courses found.
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {filtered.map((course) => (
            <Link
              key={course.id}
              href={`/admin/courses/${course.id}`}
              className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 transition hover:shadow-sm"
            >
              <div>
                <div className="font-medium">{course.title}</div>
                <div className="mt-1 flex items-center gap-3 text-sm text-[var(--muted-foreground)]">
                  <span className="rounded bg-[var(--muted)] px-2 py-0.5 text-xs">
                    {TYPE_LABELS[course.type] || course.type}
                  </span>
                  <span>{course.enrollmentCount} enrolled</span>
                  <span>
                    {course.pricing?.isFree
                      ? "Free"
                      : `${(course.pricing?.amount / 100).toLocaleString("en-IN")} ${course.pricing?.currency || "INR"}`}
                  </span>
                </div>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[course.status] || ""}`}
              >
                {course.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
