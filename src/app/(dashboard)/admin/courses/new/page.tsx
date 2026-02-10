"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function NewCoursePage() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    shortDescription: "",
    type: "self_paced" as "bootcamp" | "instructor_led" | "self_paced",
    skillLevel: "beginner" as "beginner" | "intermediate" | "advanced",
    language: "en",
    tags: "",
    pricing: {
      amount: 0,
      currency: "INR",
      originalAmount: 0,
      isFree: true,
    },
  });

  function updateField(path: string, value: string | number | boolean) {
    setForm((prev) => {
      const copy = structuredClone(prev);
      const keys = path.split(".");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let obj: any = copy;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value;
      return copy;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        ...form,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        prerequisites: [],
        instructorIds: [firebaseUser?.uid || ""],
        pricing: {
          ...form.pricing,
          amount: form.pricing.isFree ? 0 : form.pricing.amount,
          originalAmount: form.pricing.isFree ? null : form.pricing.originalAmount || null,
        },
      };

      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/admin/courses/${data.id}`);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create course");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <button
        onClick={() => router.back()}
        className="mb-4 text-sm text-[var(--muted-foreground)] hover:underline"
      >
        &larr; Back
      </button>

      <h1 className="text-2xl font-bold">Create New Course</h1>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {/* Basic Info */}
        <section className="rounded-lg border border-[var(--border)] p-4">
          <h2 className="font-semibold">Course Details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">Title</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder="Introduction to Financial Markets"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Slug</label>
              <input
                type="text"
                required
                value={form.slug}
                onChange={(e) =>
                  updateField("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                }
                placeholder="intro-financial-markets"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Type</label>
              <select
                value={form.type}
                onChange={(e) => updateField("type", e.target.value)}
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
                value={form.skillLevel}
                onChange={(e) => updateField("skillLevel", e.target.value)}
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
                value={form.language}
                onChange={(e) => updateField("language", e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">Short Description</label>
              <input
                type="text"
                required
                value={form.shortDescription}
                onChange={(e) => updateField("shortDescription", e.target.value)}
                maxLength={300}
                placeholder="A brief overview (shown in course cards)"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">Full Description</label>
              <textarea
                required
                rows={4}
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Detailed course description..."
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">
                Tags{" "}
                <span className="font-normal text-[var(--muted-foreground)]">(comma separated)</span>
              </label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => updateField("tags", e.target.value)}
                placeholder="finance, markets, investing"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="rounded-lg border border-[var(--border)] p-4">
          <h2 className="font-semibold">Pricing</h2>
          <div className="mt-4 space-y-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.pricing.isFree}
                onChange={(e) => updateField("pricing.isFree", e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm">This is a free course</span>
            </label>

            {!form.pricing.isFree && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">Price (in paise)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.pricing.amount}
                    onChange={(e) =>
                      updateField("pricing.amount", parseInt(e.target.value) || 0)
                    }
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {form.pricing.amount > 0
                      ? `= ₹${(form.pricing.amount / 100).toLocaleString("en-IN")}`
                      : "Enter amount in paise (e.g., 99900 = ₹999)"}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium">
                    Original Price (in paise, optional)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.pricing.originalAmount}
                    onChange={(e) =>
                      updateField("pricing.originalAmount", parseInt(e.target.value) || 0)
                    }
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--brand-primary)" }}
        >
          {saving ? "Creating..." : "Create Course"}
        </button>
      </form>
    </div>
  );
}
