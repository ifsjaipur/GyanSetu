"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface CourseItem {
  id: string;
  title: string;
  shortDescription: string;
  type: string;
  pricing: { amount: number; currency: string; isFree: boolean };
  skillLevel: string;
  enrollmentCount: number;
  thumbnailUrl: string;
  status: string;
}

export default function CourseCatalogPage() {
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("");

  useEffect(() => {
    async function fetchCourses() {
      try {
        const params = new URLSearchParams();
        if (typeFilter) params.set("type", typeFilter);

        const res = await fetch(`/api/courses?${params.toString()}`);
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
  }, [typeFilter]);

  function formatPrice(pricing: CourseItem["pricing"]) {
    if (pricing.isFree) return "Free";
    return `₹${(pricing.amount / 100).toLocaleString("en-IN")}`;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Courses</h1>
        <div className="flex gap-2">
          {["", "bootcamp", "instructor_led", "self_paced"].map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                typeFilter === type
                  ? "bg-[var(--brand-primary)] text-white"
                  : "bg-[var(--muted)] text-[var(--muted-foreground)]"
              }`}
            >
              {type === ""
                ? "All"
                : type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="mt-8 text-center text-[var(--muted-foreground)]">
          Loading courses...
        </div>
      ) : courses.length === 0 ? (
        <div className="mt-8 text-center text-[var(--muted-foreground)]">
          No courses available yet.
        </div>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Link
              key={course.id}
              href={`/courses/${course.id}`}
              className="group rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden transition hover:shadow-md"
            >
              <div className="aspect-video bg-[var(--muted)]">
                {course.thumbnailUrl && (
                  <img
                    src={course.thumbnailUrl}
                    alt={course.title}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-xs">
                    {course.type.replace("_", " ")}
                  </span>
                  <span className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-xs">
                    {course.skillLevel}
                  </span>
                </div>
                <h3 className="mt-2 font-semibold group-hover:text-[var(--brand-primary)]">
                  {course.title}
                </h3>
                <p className="mt-1 line-clamp-2 text-sm text-[var(--muted-foreground)]">
                  {course.shortDescription}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-bold text-[var(--brand-primary)]">
                    {formatPrice(course.pricing)}
                  </span>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {course.enrollmentCount} enrolled
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
