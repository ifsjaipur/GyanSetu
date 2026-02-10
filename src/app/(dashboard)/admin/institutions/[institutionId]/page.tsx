"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface InstitutionDetail {
  id: string;
  name: string;
  slug: string;
  domains: string[];
  primaryDomain: string;
  allowedEmailDomains: string[];
  branding: {
    logoUrl: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    headerBgColor: string;
    footerText: string;
    institutionTagline: string;
  };
  settings: {
    defaultCourseAccessDays: number;
    enableSelfRegistration: boolean;
    allowExternalUsers: boolean;
    maintenanceMode: boolean;
  };
  contactInfo: {
    supportEmail: string;
    phone: string;
    address: string;
    website: string;
  };
  isActive: boolean;
}

export default function InstitutionEditPage() {
  const { institutionId } = useParams<{ institutionId: string }>();
  const router = useRouter();
  const [inst, setInst] = useState<InstitutionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInst() {
      try {
        const res = await fetch(`/api/institutions/${institutionId}`);
        if (res.ok) setInst(await res.json());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    if (institutionId) fetchInst();
  }, [institutionId]);

  async function handleSave() {
    if (!inst) return;
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/institutions/${institutionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: inst.name,
          branding: inst.branding,
          settings: inst.settings,
          contactInfo: inst.contactInfo,
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

  if (loading) return <div className="text-[var(--muted-foreground)]">Loading...</div>;
  if (!inst) return <div>Institution not found.</div>;

  return (
    <div className="max-w-3xl">
      <button
        onClick={() => router.back()}
        className="mb-4 text-sm text-[var(--muted-foreground)] hover:underline"
      >
        &larr; Back
      </button>

      <h1 className="text-2xl font-bold">{inst.name}</h1>
      <p className="text-sm text-[var(--muted-foreground)]">
        {inst.slug} &middot; {inst.primaryDomain}
      </p>

      {message && (
        <div className={`mt-4 rounded-lg p-3 text-sm ${
          message.startsWith("Error") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
        }`}>
          {message}
        </div>
      )}

      <div className="mt-6 space-y-6">
        {/* Branding */}
        <section className="rounded-lg border border-[var(--border)] p-4">
          <h2 className="font-semibold">Branding</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">Primary Color</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={inst.branding.primaryColor}
                  onChange={(e) =>
                    setInst({
                      ...inst,
                      branding: { ...inst.branding, primaryColor: e.target.value },
                    })
                  }
                  className="h-8 w-14 cursor-pointer rounded border"
                />
                <span className="text-sm font-mono">{inst.branding.primaryColor}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium">Secondary Color</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={inst.branding.secondaryColor}
                  onChange={(e) =>
                    setInst({
                      ...inst,
                      branding: { ...inst.branding, secondaryColor: e.target.value },
                    })
                  }
                  className="h-8 w-14 cursor-pointer rounded border"
                />
                <span className="text-sm font-mono">{inst.branding.secondaryColor}</span>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">Tagline</label>
              <input
                type="text"
                value={inst.branding.institutionTagline}
                onChange={(e) =>
                  setInst({
                    ...inst,
                    branding: { ...inst.branding, institutionTagline: e.target.value },
                  })
                }
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
                value={inst.settings.defaultCourseAccessDays}
                onChange={(e) =>
                  setInst({
                    ...inst,
                    settings: {
                      ...inst.settings,
                      defaultCourseAccessDays: parseInt(e.target.value) || 90,
                    },
                  })
                }
                className="w-20 rounded border border-[var(--border)] px-2 py-1 text-sm"
              />
            </div>
            {[
              { key: "enableSelfRegistration", label: "Allow self-registration" },
              { key: "allowExternalUsers", label: "Allow external (Gmail) users" },
              { key: "maintenanceMode", label: "Maintenance mode" },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center justify-between">
                <span className="text-sm">{label}</span>
                <input
                  type="checkbox"
                  checked={(inst.settings as unknown as Record<string, boolean>)[key]}
                  onChange={(e) =>
                    setInst({
                      ...inst,
                      settings: { ...inst.settings, [key]: e.target.checked },
                    })
                  }
                  className="h-4 w-4"
                />
              </label>
            ))}
          </div>
        </section>

        {/* Contact Info */}
        <section className="rounded-lg border border-[var(--border)] p-4">
          <h2 className="font-semibold">Contact Information</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {(["supportEmail", "phone", "website", "address"] as const).map((field) => (
              <div key={field}>
                <label className="block text-sm font-medium capitalize">{field.replace(/([A-Z])/g, " $1")}</label>
                <input
                  type="text"
                  value={inst.contactInfo[field]}
                  onChange={(e) =>
                    setInst({
                      ...inst,
                      contactInfo: { ...inst.contactInfo, [field]: e.target.value },
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
              </div>
            ))}
          </div>
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
