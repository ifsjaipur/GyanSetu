"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface Lesson {
  id: string;
  title: string;
  type: string;
  textContent?: string;
  estimatedMinutes: number;
  order: number;
}

interface Module {
  id: string;
  title: string;
  description: string;
  order: number;
  lessons: Lesson[];
}

interface CourseContent {
  id: string;
  title: string;
  modules: Module[];
}

interface Enrollment {
  id: string;
  status: string;
  progress: {
    completedLessons: number;
    totalLessons: number;
    percentComplete: number;
    lastLessonId: string | null;
  };
}

export default function LearnPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const [course, setCourse] = useState<CourseContent | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  // Find the module that contains a lesson
  const findModuleForLesson = useCallback(
    (lessonId: string): string | null => {
      if (!course) return null;
      for (const mod of course.modules) {
        if (mod.lessons.some((l) => l.id === lessonId)) {
          return mod.id;
        }
      }
      return null;
    },
    [course]
  );

  useEffect(() => {
    async function fetchData() {
      try {
        // Parallel fetch: course + enrollment (saves ~500ms)
        const [courseRes, enrollRes] = await Promise.all([
          fetch(`/api/courses/${courseId}`),
          fetch(`/api/enrollments?courseId=${courseId}`),
        ]);

        if (!courseRes.ok) {
          setError("Course not found");
          setLoading(false);
          return;
        }
        const courseData = await courseRes.json();
        setCourse(courseData);

        if (!enrollRes.ok) {
          router.push(`/courses/${courseId}`);
          return;
        }

        const enrollData = await enrollRes.json();
        const enrollments = enrollData.enrollments || enrollData;
        const myEnrollment = (Array.isArray(enrollments) ? enrollments : []).find(
          (e: Enrollment) => e.status === "active"
        );

        if (!myEnrollment) {
          router.push(`/courses/${courseId}`);
          return;
        }

        setEnrollment(myEnrollment);

        // Fetch completed lessons (depends on enrollment ID)
        const progressRes = await fetch(`/api/enrollments/${myEnrollment.id}/progress`);
        if (progressRes.ok) {
          const progressData = await progressRes.json();
          setCompletedLessonIds(new Set(progressData.completedLessonIds || []));
        }

        // Set active lesson: last accessed or first lesson
        let startLesson: Lesson | null = null;
        if (myEnrollment.progress?.lastLessonId && courseData.modules) {
          for (const mod of courseData.modules) {
            const found = mod.lessons.find(
              (l: Lesson) => l.id === myEnrollment.progress.lastLessonId
            );
            if (found) {
              startLesson = found;
              break;
            }
          }
        }

        if (!startLesson && courseData.modules?.[0]?.lessons?.[0]) {
          startLesson = courseData.modules[0].lessons[0];
        }

        if (startLesson) {
          setActiveLesson(startLesson);
        }
      } catch (err) {
        console.error("Failed to load course:", err);
        setError("Failed to load course content");
      } finally {
        setLoading(false);
      }
    }

    if (courseId) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, router]);

  // Update active module when active lesson changes
  useEffect(() => {
    if (activeLesson) {
      const modId = findModuleForLesson(activeLesson.id);
      if (modId) setActiveModuleId(modId);
    }
  }, [activeLesson, findModuleForLesson]);

  // Set default lesson after course loads
  useEffect(() => {
    if (!activeLesson && course?.modules?.[0]?.lessons?.[0]) {
      setActiveLesson(course.modules[0].lessons[0]);
    }
  }, [course, activeLesson]);

  // Mark lesson as complete
  async function markLessonComplete(lesson: Lesson) {
    if (!enrollment || !course || completedLessonIds.has(lesson.id) || marking) return;

    const moduleId = findModuleForLesson(lesson.id);
    if (!moduleId) return;

    setMarking(true);
    try {
      const res = await fetch(`/api/enrollments/${enrollment.id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: lesson.id,
          moduleId,
          courseId: course.id,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCompletedLessonIds(new Set(data.completedLessonIds));
        setEnrollment((prev) =>
          prev
            ? {
                ...prev,
                progress: {
                  ...prev.progress,
                  completedLessons: data.progress.completedLessons,
                  totalLessons: data.progress.totalLessons,
                  percentComplete: data.progress.percentComplete,
                  lastLessonId: lesson.id,
                },
              }
            : prev
        );
      }
    } catch (err) {
      console.error("Failed to mark lesson complete:", err);
    } finally {
      setMarking(false);
    }
  }

  // Navigate to a lesson and auto-mark current one as complete
  function navigateToLesson(lesson: Lesson) {
    // Mark current lesson as complete when navigating away
    if (activeLesson && !completedLessonIds.has(activeLesson.id)) {
      markLessonComplete(activeLesson);
    }
    setActiveLesson(lesson);
  }

  function getAllLessons(): Lesson[] {
    if (!course) return [];
    return course.modules.flatMap((m) => m.lessons);
  }

  function getPrevLesson(): Lesson | null {
    const all = getAllLessons();
    const idx = all.findIndex((l) => l.id === activeLesson?.id);
    return idx > 0 ? all[idx - 1] : null;
  }

  function getNextLesson(): Lesson | null {
    const all = getAllLessons();
    const idx = all.findIndex((l) => l.id === activeLesson?.id);
    return idx < all.length - 1 ? all[idx + 1] : null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-[var(--muted-foreground)]">Loading course...</p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <p className="text-[var(--muted-foreground)]">{error || "Course not found"}</p>
          <button
            onClick={() => router.push("/courses")}
            className="mt-4 text-sm text-[var(--brand-primary)] hover:underline"
          >
            Back to courses
          </button>
        </div>
      </div>
    );
  }

  const allLessons = getAllLessons();
  const totalLessons = allLessons.length;
  const completedCount = completedLessonIds.size;
  const progressPercent = enrollment?.progress.percentComplete ?? (totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0);

  return (
    <div className="flex gap-6 max-w-6xl">
      {/* Sidebar — Module & Lesson navigation */}
      <div className="w-72 shrink-0">
        <button
          onClick={() => router.push(`/courses/${courseId}`)}
          className="mb-4 text-sm text-[var(--muted-foreground)] hover:underline"
        >
          &larr; Back to course
        </button>

        <h2 className="text-lg font-bold mb-1">{course.title}</h2>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)] mb-1">
            <span>{completedCount} / {totalLessons} lessons</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--muted)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--brand-primary)] transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="space-y-3">
          {course.modules.map((module, mi) => {
            const moduleLessonsCompleted = module.lessons.filter((l) =>
              completedLessonIds.has(l.id)
            ).length;
            const isModuleComplete = module.lessons.length > 0 && moduleLessonsCompleted === module.lessons.length;

            return (
              <div key={module.id}>
                <h3 className="text-xs font-semibold uppercase text-[var(--muted-foreground)] mb-1 flex items-center gap-1">
                  {isModuleComplete && (
                    <span className="text-green-500" title="Module complete">&#10003;</span>
                  )}
                  Module {mi + 1}: {module.title}
                  <span className="ml-auto font-normal">
                    {moduleLessonsCompleted}/{module.lessons.length}
                  </span>
                </h3>
                <ul className="space-y-0.5">
                  {module.lessons.map((lesson) => {
                    const isCompleted = completedLessonIds.has(lesson.id);
                    const isActive = activeLesson?.id === lesson.id;

                    return (
                      <li key={lesson.id}>
                        <button
                          onClick={() => navigateToLesson(lesson)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                            isActive
                              ? "bg-[var(--brand-primary)] text-white"
                              : "hover:bg-[var(--muted)]"
                          }`}
                        >
                          {/* Completion indicator */}
                          <span
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 text-xs ${
                              isCompleted
                                ? isActive
                                  ? "bg-white text-[var(--brand-primary)] border-white"
                                  : "bg-green-500 text-white border-green-500"
                                : isActive
                                  ? "border-white/50"
                                  : "border-[var(--border)]"
                            }`}
                          >
                            {isCompleted && "✓"}
                          </span>
                          <span className="truncate">{lesson.title}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 min-w-0">
        {activeLesson ? (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h1 className="text-xl font-bold">{activeLesson.title}</h1>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--muted-foreground)]">
                  {activeLesson.estimatedMinutes} min
                </span>
                {completedLessonIds.has(activeLesson.id) ? (
                  <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    ✓ Completed
                  </span>
                ) : (
                  <button
                    onClick={() => markLessonComplete(activeLesson)}
                    disabled={marking}
                    className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full border border-[var(--border)] hover:bg-[var(--muted)] disabled:opacity-50"
                  >
                    {marking ? "Saving..." : "Mark Complete"}
                  </button>
                )}
              </div>
            </div>

            {activeLesson.type === "text" && activeLesson.textContent && (
              <div className="prose prose-sm max-w-none rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
                {activeLesson.textContent.split("\n").map((line, i) => {
                  if (line.startsWith("## ")) {
                    return (
                      <h2 key={i} className="text-lg font-bold mt-4 mb-2">
                        {line.replace("## ", "")}
                      </h2>
                    );
                  }
                  if (line.startsWith("- **")) {
                    const match = line.match(/- \*\*(.+?)\*\*\s*[-–—]\s*(.+)/);
                    if (match) {
                      return (
                        <p key={i} className="ml-4 mb-1">
                          <strong>{match[1]}</strong> — {match[2]}
                        </p>
                      );
                    }
                  }
                  if (line.match(/^\d+\.\s\*\*/)) {
                    const match = line.match(/^\d+\.\s\*\*(.+?)\*\*\s*[-–—]\s*(.+)/);
                    if (match) {
                      return (
                        <p key={i} className="ml-4 mb-1">
                          <strong>{match[1]}</strong> — {match[2]}
                        </p>
                      );
                    }
                  }
                  if (line.trim() === "") return <br key={i} />;
                  return <p key={i} className="mb-2">{line}</p>;
                })}
              </div>
            )}

            {activeLesson.type === "video" && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-center">
                <p className="text-[var(--muted-foreground)]">
                  Video player will be available soon.
                </p>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="mt-6 flex justify-between">
              {getPrevLesson() ? (
                <button
                  onClick={() => navigateToLesson(getPrevLesson()!)}
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--muted)]"
                >
                  &larr; Previous
                </button>
              ) : (
                <div />
              )}
              {getNextLesson() ? (
                <button
                  onClick={() => navigateToLesson(getNextLesson()!)}
                  className="rounded-lg px-4 py-2 text-sm text-white"
                  style={{ backgroundColor: "var(--brand-primary)" }}
                >
                  Next &rarr;
                </button>
              ) : completedCount === totalLessons && totalLessons > 0 ? (
                <span className="inline-flex items-center gap-2 text-sm text-green-600 font-medium">
                  ✓ Course complete!
                </span>
              ) : (
                <div />
              )}
            </div>
          </div>
        ) : (
          <div className="text-center text-[var(--muted-foreground)]">
            <p>Select a lesson from the sidebar to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
