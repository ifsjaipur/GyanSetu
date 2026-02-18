"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import LocationFields from "@/components/LocationFields";

interface InstitutionDetail {
  id: string;
  name: string;
  slug: string;
  institutionType?: "mother" | "child_online" | "child_offline";
  parentInstitutionId?: string | null;
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
  googleWorkspace?: {
    adminEmail: string;
    customerDomain: string;
    classroomTeacherEmail: string;
  };
  settings: {
    defaultCourseAccessDays: number;
    enableSelfRegistration: boolean;
    allowExternalUsers: boolean;
    maintenanceMode: boolean;
    locale: string;
  };
  location?: {
    country: string;
    state: string;
    city: string;
    timezone: string;
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

  // Comma-separated string for editing allowedEmailDomains
  const [domainsText, setDomainsText] = useState("");

  useEffect(() => {
    async function fetchInst() {
      try {
        const res = await fetch(`/api/institutions/${institutionId}`);
        if (res.ok) {
          const data = await res.json();
          setInst(data);
          setDomainsText((data.allowedEmailDomains || []).join(", "));
        }
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

    // Parse domains from comma-separated text
    const allowedEmailDomains = domainsText
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);

    try {
      const res = await fetch(`/api/institutions/${institutionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: inst.name,
          institutionType: inst.institutionType,
          parentInstitutionId: inst.parentInstitutionId,
          allowedEmailDomains,
          branding: inst.branding,
          googleWorkspace: inst.googleWorkspace,
          settings: inst.settings,
          contactInfo: inst.contactInfo,
          location: inst.location,
        }),
      });

      if (res.ok) {
        setMessage("Saved successfully");
        const root = document.documentElement;
        if (inst.branding.primaryColor) root.style.setProperty("--brand-primary", inst.branding.primaryColor);
        if (inst.branding.secondaryColor) root.style.setProperty("--brand-secondary", inst.branding.secondaryColor);
        if (inst.branding.accentColor) root.style.setProperty("--brand-accent", inst.branding.accentColor);
        if (inst.branding.headerBgColor) root.style.setProperty("--brand-header-bg", inst.branding.headerBgColor);
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
      <div className="flex items-center gap-2">
        <p className="text-sm text-[var(--muted-foreground)]">{inst.slug}</p>
        {inst.institutionType && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            inst.institutionType === "mother"
              ? "bg-purple-100 text-purple-700"
              : inst.institutionType === "child_offline"
                ? "bg-orange-100 text-orange-700"
                : "bg-blue-100 text-blue-700"
          }`}>
            {inst.institutionType === "mother" ? "Global" : inst.institutionType === "child_online" ? "Online Center" : "Offline Center"}
          </span>
        )}
      </div>

      {message && (
        <div className={`mt-4 rounded-lg p-3 text-sm ${
          message.startsWith("Error") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
        }`}>
          {message}
        </div>
      )}

      <div className="mt-6 space-y-6">
        {/* General */}
        <section className="rounded-lg border border-[var(--border)] p-4">
          <h2 className="font-semibold">General</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">Institution Name</label>
              <input
                type="text"
                value={inst.name}
                onChange={(e) => setInst({ ...inst, name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">Logo URL</label>
              <input
                type="text"
                value={inst.branding.logoUrl}
                onChange={(e) =>
                  setInst({
                    ...inst,
                    branding: { ...inst.branding, logoUrl: e.target.value },
                  })
                }
                placeholder="https://example.com/logo.png"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
              {inst.branding.logoUrl && (
                <div className="mt-2 flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={inst.branding.logoUrl}
                    alt="Logo preview"
                    className="h-10 w-auto rounded border border-[var(--border)]"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <span className="text-xs text-[var(--muted-foreground)]">Preview</span>
                </div>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">
                Allowed Email Domains
                <span className="ml-1 font-normal text-[var(--muted-foreground)]">(comma separated)</span>
              </label>
              <input
                type="text"
                value={domainsText}
                onChange={(e) => setDomainsText(e.target.value)}
                placeholder="example.com, university.edu"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Users with these email domains are auto-assigned to this institution and eligible for instructor/admin roles.
              </p>
            </div>
          </div>
        </section>

        {/* Location */}
        <section className="rounded-lg border border-[var(--border)] p-4">
          <h2 className="font-semibold">Location</h2>
          <div className="mt-4">
            <LocationFields
              value={{
                country: inst.location?.country || "",
                state: inst.location?.state || "",
                city: inst.location?.city || "",
                timezone: inst.location?.timezone || "Asia/Kolkata",
              }}
              onChange={(loc) =>
                setInst({
                  ...inst,
                  location: {
                    country: loc.country,
                    state: loc.state,
                    city: loc.city,
                    timezone: inst.location?.timezone || "Asia/Kolkata",
                  },
                })
              }
            />
          </div>
        </section>

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
            <div className="flex items-center justify-between">
              <span className="text-sm">Language / Locale</span>
              <select
                value={inst.settings.locale || "en"}
                onChange={(e) =>
                  setInst({
                    ...inst,
                    settings: { ...inst.settings, locale: e.target.value },
                  })
                }
                className="w-40 rounded border border-[var(--border)] px-2 py-1 text-sm"
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="kn">Kannada</option>
                <option value="mr">Marathi</option>
                <option value="ta">Tamil</option>
                <option value="te">Telugu</option>
                <option value="bn">Bengali</option>
                <option value="gu">Gujarati</option>
              </select>
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

        {/* Google Workspace */}
        <section className="rounded-lg border border-[var(--border)] p-4">
          <h2 className="font-semibold">Google Workspace</h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Required for Google Meet auto-creation and Google Classroom integration.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">
                Admin Email *
                <span className="ml-1 font-normal text-[var(--muted-foreground)]">
                  (Google Workspace admin who owns Calendar events)
                </span>
              </label>
              <input
                type="email"
                value={inst.googleWorkspace?.adminEmail || ""}
                onChange={(e) =>
                  setInst({
                    ...inst,
                    googleWorkspace: {
                      adminEmail: e.target.value,
                      customerDomain: inst.googleWorkspace?.customerDomain || "",
                      classroomTeacherEmail: inst.googleWorkspace?.classroomTeacherEmail || "",
                    },
                  })
                }
                placeholder="admin@yourdomain.com"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Customer Domain</label>
              <input
                type="text"
                value={inst.googleWorkspace?.customerDomain || ""}
                onChange={(e) =>
                  setInst({
                    ...inst,
                    googleWorkspace: {
                      adminEmail: inst.googleWorkspace?.adminEmail || "",
                      customerDomain: e.target.value,
                      classroomTeacherEmail: inst.googleWorkspace?.classroomTeacherEmail || "",
                    },
                  })
                }
                placeholder="yourdomain.com"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Classroom Teacher Email</label>
              <input
                type="email"
                value={inst.googleWorkspace?.classroomTeacherEmail || ""}
                onChange={(e) =>
                  setInst({
                    ...inst,
                    googleWorkspace: {
                      adminEmail: inst.googleWorkspace?.adminEmail || "",
                      customerDomain: inst.googleWorkspace?.customerDomain || "",
                      classroomTeacherEmail: e.target.value,
                    },
                  })
                }
                placeholder="teacher@yourdomain.com"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
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
