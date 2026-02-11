"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Course {
  id: string;
  title: string;
  type: string;
  status: string;
  enrollmentCount: number;
}

export default function InstructorCoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCourses() {
      try {
        const res = await fetch("/api/courses");
        if (res.ok) {
          const data = await res.json();
          setCourses(data.courses || []);
        }
      } catch (err) {
        console.error("Failed to fetch courses:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCourses();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-[var(--muted-foreground)]">Loading courses...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">My Courses</h1>
      <p className="text-sm text-[var(--muted-foreground)] mb-6">
        Select a course to manage sessions, attendance, and certificates.
      </p>

      {courses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
          <p className="text-[var(--muted-foreground)]">No courses assigned to you.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <div
              key={course.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"
            >
              <h3 className="font-semibold text-sm">{course.title}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-[var(--muted-foreground)] capitalize">
                  {course.type?.replace(/_/g, " ")}
                </span>
                <span className="text-xs text-[var(--muted-foreground)]">
                  &middot; {course.enrollmentCount || 0} students
                </span>
              </div>

              <div className="mt-4 flex gap-2 flex-wrap">
                {course.type === "bootcamp" && (
                  <button
                    onClick={() => router.push(`/instructor/courses/${course.id}/sessions`)}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--muted)]"
                  >
                    Sessions
                  </button>
                )}
                <button
                  onClick={() => router.push(`/instructor/courses/${course.id}/attendance`)}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--muted)]"
                >
                  Attendance
                </button>
                <button
                  onClick={() => router.push(`/instructor/courses/${course.id}/certificates`)}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--muted)]"
                >
                  Certificates
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
