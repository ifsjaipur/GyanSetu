"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import RichTextEditor from "@/components/RichTextEditor";
import { trimWhitespace } from "@/lib/utils/normalize";

interface InstructorOption {
  uid: string;
  displayName: string;
  email: string;
}

interface CourseDetail {
  id: string;
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  thumbnailUrl: string;
  type: string;
  skillLevel: string;
  language: string;
  status: string;
  tags: string[];
  instructorIds: string[];
  enrollmentCount: number;
  pricing: {
    amount: number;
    currency: string;
    originalAmount: number | null;
    isFree: boolean;
  };
  modules: {
    id: string;
    title: string;
    order: number;
    isPublished: boolean;
    lessons: { id: string; title: string; type: string; order: number }[];
  }[];
}

const STATUS_OPTIONS = ["draft", "published", "archived"];

export default function AdminCourseEditPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [instructors, setInstructors] = useState<InstructorOption[]>([]);
  const [selectedInstructors, setSelectedInstructors] = useState<string[]>([]);

  useEffect(() => {
    async function fetchCourse() {
      try {
        const res = await fetch(`/api/courses/${courseId}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setCourse(data);
          setSelectedInstructors(data.instructorIds || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    async function fetchInstructors() {
      try {
        const res = await fetch("/api/users?role=instructor");
        if (res.ok) {
          const data = await res.json();
          setInstructors(data.users || []);
        }
      } catch { /* ignore */ }
    }

    if (courseId) fetchCourse();
    fetchInstructors();
  }, [courseId]);

  async function handleSave() {
    if (!course) return;
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: course.title,
          slug: course.slug,
          description: course.description,
          shortDescription: course.shortDescription,
          thumbnailUrl: course.thumbnailUrl,
          type: course.type,
          skillLevel: course.skillLevel,
          language: course.language,
          tags: course.tags,
          instructorIds: selectedInstructors,
          pricing: course.pricing,
        }),
      });

      if (res.ok) {
        setMessage("Saved successfully");
      } else {
        const data = await res.json();
        setMessage(`Error: ${data.error}`);
      }
    } catch {
      setMessage("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (!course) return;
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          isVisible: newStatus === "published",
        }),
      });

      if (res.ok) {
        // Re-fetch to get the latest data (status, enrollmentCount, etc.)
        const freshRes = await fetch(`/api/courses/${courseId}`, { cache: "no-store" });
        if (freshRes.ok) {
          const freshData = await freshRes.json();
          setCourse(freshData);
          setSelectedInstructors(freshData.instructorIds || []);
        } else {
          setCourse({ ...course, status: newStatus });
        }
        setMessage(`Status changed to ${newStatus}`);
      } else {
        const data = await res.json();
        setMessage(`Error: ${data.error}`);
      }
    } catch {
      setMessage("Failed to update status");
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return <div className="text-[var(--muted-foreground)]">Loading...</div>;
  if (!course) return <div>Course not found.</div>;

  return (
    <div className="max-w-3xl">
      <button
        onClick={() => router.back()}
        className="mb-4 text-sm text-[var(--muted-foreground)] hover:underline"
      >
        &larr; Back
      </button>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{course.title}</h1>
        <div className="flex items-center gap-2">
          {STATUS_OPTIONS.filter((s) => s !== course.status).map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              disabled={saving}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium capitalize hover:bg-[var(--muted)]"
            >
              {s === "published" ? "Publish" : s === "archived" ? "Archive" : "Draft"}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        {course.slug} &middot; {course.type.replace("_", " ")} &middot;{" "}
        <span className="capitalize">{course.status}</span> &middot;{" "}
        {course.enrollmentCount} enrolled
      </p>

      {message && (
        <div
          className={`mt-4 rounded-lg p-3 text-sm ${
            message.startsWith("Error")
              ? "bg-red-50 text-red-600"
              : "bg-green-50 text-green-600"
          }`}
        >
          {message}
        </div>
      )}

      <div className="mt-6 space-y-6">
        {/* Basic Details */}
        <section className="rounded-lg border border-[var(--border)] p-4">
          <h2 className="font-semibold">Course Details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">Title</label>
              <input
                type="text"
                value={course.title}
                onChange={(e) => setCourse({ ...course, title: e.target.value })}
                onBlur={(e) => setCourse((c) => c ? { ...c, title: trimWhitespace(e.target.value) } : c)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Slug</label>
              <input
                type="text"
                value={course.slug}
                onChange={(e) =>
                  setCourse({
                    ...course,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                  })
                }
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Type</label>
              <select
                value={course.type}
                onChange={(e) => setCourse({ ...course, type: e.target.value })}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                <option value="self_paced">Self Paced</option>
                <option value="instructor_led">Instructor Led</option>
                <option value="bootcamp">Bootcamp</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Skill Level</label>
              <select
                value={course.skillLevel}
                onChange={(e) => setCourse({ ...course, skillLevel: e.target.value })}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Language</label>
              <input
                type="text"
                value={course.language}
                onChange={(e) => setCourse({ ...course, language: e.target.value })}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">Short Description</label>
              <input
                type="text"
                value={course.shortDescription}
                onChange={(e) =>
                  setCourse({ ...course, shortDescription: e.target.value })
                }
                onBlur={(e) => setCourse((c) => c ? { ...c, shortDescription: trimWhitespace(e.target.value) } : c)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">Full Description</label>
              <RichTextEditor
                value={course.description}
                onChange={(html) => setCourse({ ...course, description: html })}
                placeholder="Detailed course description..."
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">Tags (comma separated)</label>
              <input
                type="text"
                value={course.tags?.join(", ") || ""}
                onChange={(e) =>
                  setCourse({
                    ...course,
                    tags: e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  })
                }
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">
                Thumbnail URL{" "}
                <span className="font-normal text-[var(--muted-foreground)]">(optional)</span>
              </label>
              <input
                type="url"
                value={course.thumbnailUrl || ""}
                onChange={(e) => setCourse({ ...course, thumbnailUrl: e.target.value })}
                placeholder="https://example.com/course-image.jpg"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
              {course.thumbnailUrl && (
                <div className="mt-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={course.thumbnailUrl}
                    alt="Thumbnail preview"
                    className="h-24 w-auto rounded-lg border border-[var(--border)] object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Instructor Assignment */}
        <section className="rounded-lg border border-[var(--border)] p-4">
          <h2 className="font-semibold">Assigned Instructors</h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Select instructors who can manage this course
          </p>
          <div className="mt-3 space-y-2">
            {instructors.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">No instructors found.</p>
            ) : (
              instructors.map((inst) => (
                <label key={inst.uid} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedInstructors.includes(inst.uid)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedInstructors((prev) => [...prev, inst.uid]);
                      } else {
                        setSelectedInstructors((prev) => prev.filter((id) => id !== inst.uid));
                      }
                    }}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">
                    {inst.displayName || inst.email}
                    {inst.displayName && (
                      <span className="ml-1 text-[var(--muted-foreground)]">({inst.email})</span>
                    )}
                  </span>
                </label>
              ))
            )}
          </div>
        </section>

        {/* Pricing */}
        <section className="rounded-lg border border-[var(--border)] p-4">
          <h2 className="font-semibold">Pricing</h2>
          <div className="mt-4 space-y-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={course.pricing?.isFree}
                onChange={(e) =>
                  setCourse({
                    ...course,
                    pricing: { ...course.pricing, isFree: e.target.checked },
                  })
                }
                className="h-4 w-4"
              />
              <span className="text-sm">Free course</span>
            </label>
            {!course.pricing?.isFree && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">Price (paise)</label>
                  <input
                    type="number"
                    value={course.pricing?.amount || 0}
                    onChange={(e) =>
                      setCourse({
                        ...course,
                        pricing: {
                          ...course.pricing,
                          amount: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    = ₹{((course.pricing?.amount || 0) / 100).toLocaleString("en-IN")}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium">
                    Original Price (paise)
                  </label>
                  <input
                    type="number"
                    value={course.pricing?.originalAmount || 0}
                    onChange={(e) =>
                      setCourse({
                        ...course,
                        pricing: {
                          ...course.pricing,
                          originalAmount: parseInt(e.target.value) || null,
                        },
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Modules */}
        <section className="rounded-lg border border-[var(--border)] p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">
              Modules ({course.modules?.length || 0})
            </h2>
            <a
              href={`/instructor/courses/${courseId}/modules`}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--muted)]"
            >
              Manage Content
            </a>
          </div>
          {course.modules?.length > 0 ? (
            <div className="mt-4 space-y-3">
              {course.modules.map((mod) => (
                <div
                  key={mod.id}
                  className="rounded-lg border border-[var(--border)] p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{mod.title}</span>
                    <span
                      className={`text-xs ${
                        mod.isPublished ? "text-green-600" : "text-yellow-600"
                      }`}
                    >
                      {mod.isPublished ? "Published" : "Draft"}
                    </span>
                  </div>
                  {mod.lessons?.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {mod.lessons.map((lesson) => (
                        <div
                          key={lesson.id}
                          className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]"
                        >
                          <span className="rounded bg-[var(--muted)] px-1.5 py-0.5">
                            {lesson.type}
                          </span>
                          <span>{lesson.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--muted-foreground)]">
              No modules yet. Modules and lessons can be managed after creating the course.
            </p>
          )}
        </section>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-6 rounded-lg px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        style={{ backgroundColor: "var(--brand-primary)" }}
      >
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );
}
