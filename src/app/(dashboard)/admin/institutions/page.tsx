"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

interface InstitutionItem {
  id: string;
  name: string;
  slug: string;
  institutionType?: "mother" | "child_online" | "child_offline";
  allowedEmailDomains: string[];
  isActive: boolean;
  branding: { primaryColor: string };
}

export default function InstitutionsListPage() {
  const { userData } = useAuth();
  const [institutions, setInstitutions] = useState<InstitutionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch_() {
      try {
        const res = await fetch("/api/institutions");
        if (res.ok) {
          const data = await res.json();
          setInstitutions(data.institutions);
        }
      } catch (err) {
        console.error("Failed to fetch institutions:", err);
      } finally {
        setLoading(false);
      }
    }

    fetch_();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Institutions</h1>
        {userData?.role === "super_admin" && (
          <Link
            href="/admin/institutions/new"
            className="rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            + New Institution
          </Link>
        )}
      </div>

      {loading ? (
        <div className="mt-8 text-[var(--muted-foreground)]">Loading...</div>
      ) : (
        <div className="mt-6 space-y-3">
          {institutions.map((inst) => (
            <Link
              key={inst.id}
              href={`/admin/institutions/${inst.id}`}
              className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 transition hover:shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-lg"
                  style={{ backgroundColor: inst.branding?.primaryColor || "#1E40AF" }}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{inst.name}</span>
                    {inst.institutionType && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
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
                  <div className="text-sm text-[var(--muted-foreground)]">
                    {inst.slug}{inst.allowedEmailDomains?.length ? ` · ${inst.allowedEmailDomains.join(", ")}` : ""}
                  </div>
                </div>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  inst.isActive
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {inst.isActive ? "Active" : "Inactive"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
