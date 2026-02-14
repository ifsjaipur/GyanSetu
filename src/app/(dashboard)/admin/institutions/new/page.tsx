"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewInstitutionPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    primaryDomain: "",
    domains: "",
    allowedEmailDomains: "",
    branding: {
      logoUrl: "",
      faviconUrl: "",
      primaryColor: "#1E40AF",
      secondaryColor: "#1E3A5F",
      accentColor: "#F59E0B",
      headerBgColor: "#FFFFFF",
      footerText: "",
      institutionTagline: "",
    },
    location: {
      country: "",
      state: "",
      city: "",
      timezone: "Asia/Kolkata",
    },
    contactInfo: {
      supportEmail: "",
      phone: "",
      address: "",
      website: "",
    },
    settings: {
      defaultCourseAccessDays: 90,
      enableSelfRegistration: true,
      allowExternalUsers: true,
      requireEmailVerification: false,
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
      const payload: Record<string, unknown> = {
        ...form,
        domains: form.domains
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean),
        allowedEmailDomains: form.allowedEmailDomains
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean),
      };

      // Only include location if at least one field is filled
      if (!form.location.country && !form.location.state && !form.location.city) {
        delete payload.location;
      }

      const res = await fetch("/api/institutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/admin/institutions/${data.id}`);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create institution");
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

      <h1 className="text-2xl font-bold">Create New Institution</h1>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {/* Basic Info */}
        <section className="rounded-lg border border-[var(--border)] p-4">
          <h2 className="font-semibold">Basic Information</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Institute of Financial Studies"
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
                placeholder="ifs"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Primary Domain</label>
              <input
                type="text"
                required
                value={form.primaryDomain}
                onChange={(e) => updateField("primaryDomain", e.target.value)}
                placeholder="learn.ifsjaipur.com"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">
                All Domains <span className="font-normal text-[var(--muted-foreground)]">(comma separated)</span>
              </label>
              <input
                type="text"
                required
                value={form.domains}
                onChange={(e) => updateField("domains", e.target.value)}
                placeholder="learn.ifsjaipur.com, ifsjaipur.com"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">
                Allowed Email Domains{" "}
                <span className="font-normal text-[var(--muted-foreground)]">(comma separated)</span>
              </label>
              <input
                type="text"
                required
                value={form.allowedEmailDomains}
                onChange={(e) => updateField("allowedEmailDomains", e.target.value)}
                placeholder="ifsjaipur.com, gmail.com"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
          </div>
        </section>

        {/* Location */}
        <section className="rounded-lg border border-[var(--border)] p-4">
          <h2 className="font-semibold">Location</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium">Country</label>
              <input
                type="text"
                value={form.location.country}
                onChange={(e) => updateField("location.country", e.target.value)}
                placeholder="India"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">State</label>
              <input
                type="text"
                value={form.location.state}
                onChange={(e) => updateField("location.state", e.target.value)}
                placeholder="Rajasthan"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">City</label>
              <input
                type="text"
                value={form.location.city}
                onChange={(e) => updateField("location.city", e.target.value)}
                placeholder="Jaipur"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
          </div>
        </section>

        {/* Branding */}
        <section className="rounded-lg border border-[var(--border)] p-4">
          <h2 className="font-semibold">Branding</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">Logo URL</label>
              <input
                type="url"
                value={form.branding.logoUrl}
                onChange={(e) => updateField("branding.logoUrl", e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Favicon URL</label>
              <input
                type="url"
                value={form.branding.faviconUrl}
                onChange={(e) => updateField("branding.faviconUrl", e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            {(
              [
                ["primaryColor", "Primary Color"],
                ["secondaryColor", "Secondary Color"],
                ["accentColor", "Accent Color"],
                ["headerBgColor", "Header Background"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <label className="block text-sm font-medium">{label}</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={form.branding[key]}
                    onChange={(e) => updateField(`branding.${key}`, e.target.value)}
                    className="h-8 w-14 cursor-pointer rounded border"
                  />
                  <span className="font-mono text-sm">{form.branding[key]}</span>
                </div>
              </div>
            ))}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">Tagline</label>
              <input
                type="text"
                value={form.branding.institutionTagline}
                onChange={(e) => updateField("branding.institutionTagline", e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">Footer Text</label>
              <input
                type="text"
                value={form.branding.footerText}
                onChange={(e) => updateField("branding.footerText", e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
          </div>
        </section>

        {/* Contact Info */}
        <section className="rounded-lg border border-[var(--border)] p-4">
          <h2 className="font-semibold">Contact Information</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">Support Email</label>
              <input
                type="email"
                required
                value={form.contactInfo.supportEmail}
                onChange={(e) => updateField("contactInfo.supportEmail", e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Phone</label>
              <input
                type="tel"
                required
                value={form.contactInfo.phone}
                onChange={(e) => updateField("contactInfo.phone", e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Website</label>
              <input
                type="url"
                value={form.contactInfo.website}
                onChange={(e) => updateField("contactInfo.website", e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Address</label>
              <input
                type="text"
                value={form.contactInfo.address}
                onChange={(e) => updateField("contactInfo.address", e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
          </div>
        </section>

        {/* Settings */}
        <section className="rounded-lg border border-[var(--border)] p-4">
          <h2 className="font-semibold">Settings</h2>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Default course access (days)</span>
              <input
                type="number"
                value={form.settings.defaultCourseAccessDays}
                onChange={(e) =>
                  updateField("settings.defaultCourseAccessDays", parseInt(e.target.value) || 90)
                }
                className="w-20 rounded border border-[var(--border)] px-2 py-1 text-sm"
              />
            </div>
            {(
              [
                ["enableSelfRegistration", "Allow self-registration"],
                ["allowExternalUsers", "Allow external (Gmail) users"],
                ["requireEmailVerification", "Require email verification"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between">
                <span className="text-sm">{label}</span>
                <input
                  type="checkbox"
                  checked={form.settings[key]}
                  onChange={(e) => updateField(`settings.${key}`, e.target.checked)}
                  className="h-4 w-4"
                />
              </label>
            ))}
          </div>
        </section>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--brand-primary)" }}
        >
          {saving ? "Creating..." : "Create Institution"}
        </button>
      </form>
    </div>
  );
}
