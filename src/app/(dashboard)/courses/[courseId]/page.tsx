"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface CourseDetail {
  id: string;
  title: string;
  description: string;
  shortDescription: string;
  type: string;
  pricing: { amount: number; currency: string; isFree: boolean; originalAmount: number | null };
  skillLevel: string;
  language: string;
  enrollmentCount: number;
  thumbnailUrl: string;
  tags: string[];
  instructorIds: string[];
  modules: {
    id: string;
    title: string;
    description: string;
    lessons: { id: string; title: string; type: string; estimatedMinutes: number }[];
  }[];
  selfPacedConfig?: { accessDurationDays: number; estimatedHours: number } | null;
  bootcampConfig?: { startDate: string; endDate: string } | null;
}

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCourse() {
      try {
        const res = await fetch(`/api/courses/${courseId}`);
        if (res.ok) {
          setCourse(await res.json());
        } else if (res.status === 404) {
          router.push("/courses");
        }
      } catch (err) {
        console.error("Failed to fetch course:", err);
      } finally {
        setLoading(false);
      }
    }

    if (courseId) fetchCourse();
  }, [courseId, router]);

  if (loading) {
    return <div className="text-[var(--muted-foreground)]">Loading...</div>;
  }

  if (!course) {
    return <div className="text-[var(--muted-foreground)]">Course not found.</div>;
  }

  function formatPrice() {
    if (!course) return "";
    if (course.pricing.isFree) return "Free";
    return `₹${(course.pricing.amount / 100).toLocaleString("en-IN")}`;
  }

  const totalLessons = course.modules.reduce(
    (sum, m) => sum + m.lessons.length,
    0
  );

  return (
    <div className="max-w-4xl">
      <button
        onClick={() => router.back()}
        className="mb-4 text-sm text-[var(--muted-foreground)] hover:underline"
      >
        &larr; Back to courses
      </button>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        {course.thumbnailUrl && (
          <div className="aspect-[3/1] bg-[var(--muted)]">
            <img
              src={course.thumbnailUrl}
              alt={course.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <div className="p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--muted)] px-3 py-1 text-xs font-medium">
              {course.type.replace("_", " ")}
            </span>
            <span className="rounded-full bg-[var(--muted)] px-3 py-1 text-xs">
              {course.skillLevel}
            </span>
            <span className="rounded-full bg-[var(--muted)] px-3 py-1 text-xs">
              {course.language}
            </span>
          </div>

          <h1 className="mt-4 text-2xl font-bold">{course.title}</h1>
          <p className="mt-2 text-[var(--muted-foreground)]">
            {course.description}
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-[var(--muted)] p-4 text-center">
              <div className="text-2xl font-bold">{course.modules.length}</div>
              <div className="text-sm text-[var(--muted-foreground)]">Modules</div>
            </div>
            <div className="rounded-lg bg-[var(--muted)] p-4 text-center">
              <div className="text-2xl font-bold">{totalLessons}</div>
              <div className="text-sm text-[var(--muted-foreground)]">Lessons</div>
            </div>
            <div className="rounded-lg bg-[var(--muted)] p-4 text-center">
              <div className="text-2xl font-bold">{course.enrollmentCount}</div>
              <div className="text-sm text-[var(--muted-foreground)]">Enrolled</div>
            </div>
          </div>

          {course.selfPacedConfig && (
            <p className="mt-4 text-sm text-[var(--muted-foreground)]">
              Access: {course.selfPacedConfig.accessDurationDays} days |{" "}
              Estimated: {course.selfPacedConfig.estimatedHours} hours
            </p>
          )}

          <div className="mt-6 flex items-center gap-4">
            <span className="text-3xl font-bold text-[var(--brand-primary)]">
              {formatPrice()}
            </span>
            {course.pricing.originalAmount && !course.pricing.isFree && (
              <span className="text-lg text-[var(--muted-foreground)] line-through">
                ₹{(course.pricing.originalAmount / 100).toLocaleString("en-IN")}
              </span>
            )}
          </div>

          <button
            onClick={() => router.push(`/courses/${courseId}/enroll`)}
            className="mt-4 rounded-lg px-6 py-3 text-sm font-medium text-white"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            {course.pricing.isFree ? "Enroll for Free" : "Enroll Now"}
          </button>
        </div>
      </div>

      {/* Course Curriculum */}
      {course.modules.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold">Curriculum</h2>
          <div className="mt-4 space-y-3">
            {course.modules.map((module, i) => (
              <div
                key={module.id}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)]"
              >
                <div className="p-4">
                  <h3 className="font-medium">
                    Module {i + 1}: {module.title}
                  </h3>
                  {module.description && (
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                      {module.description}
                    </p>
                  )}
                  <ul className="mt-3 space-y-1">
                    {module.lessons.map((lesson) => (
                      <li
                        key={lesson.id}
                        className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]"
                      >
                        <span className="text-xs">
                          {lesson.type === "video" ? "▶" : "📄"}
                        </span>
                        <span>{lesson.title}</span>
                        <span className="ml-auto text-xs">
                          {lesson.estimatedMinutes} min
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {course.tags.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {course.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-[var(--muted)] px-3 py-1 text-xs"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
