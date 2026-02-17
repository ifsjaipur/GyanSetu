"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CategoryOption {
  id: string;
  label: string;
  description: string;
}

const CATEGORIES: CategoryOption[] = [
  { id: "institutions", label: "Institutions", description: "All institution configs (you'll need to recreate them)" },
  { id: "users", label: "Users", description: "All users + Firebase Auth accounts + memberships (your admin account is preserved)" },
  { id: "courses", label: "Courses", description: "All courses, modules, lessons, and sessions" },
  { id: "enrollments", label: "Enrollments", description: "All enrollment records" },
  { id: "payments", label: "Payments", description: "All payment/transaction records" },
  { id: "certificates", label: "Certificates", description: "All issued certificates" },
  { id: "exams", label: "Exams", description: "All exams and exam attempts" },
  { id: "attendance", label: "Attendance", description: "All attendance records" },
  { id: "videoProgress", label: "Video Progress", description: "All video watch progress" },
  { id: "zoomMeetings", label: "Zoom Meetings", description: "All Zoom meeting records and participants" },
  { id: "auditLogs", label: "Audit Logs", description: "All audit log entries" },
  { id: "pushSubscriptions", label: "Push Subscriptions", description: "All push notification subscriptions" },
];

export default function ResetDataPage() {
  const router = useRouter();
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allSelected = selectedCategories.size === CATEGORIES.length;
  const noneSelected = selectedCategories.size === 0;
  const isConfirmed = confirmPhrase === "DELETE ALL DATA" && !noneSelected;

  function toggleCategory(id: string) {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedCategories(new Set());
    } else {
      setSelectedCategories(new Set(CATEGORIES.map((c) => c.id)));
    }
  }

  async function handleReset() {
    if (!isConfirmed) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90_000);

    try {
      const res = await fetch("/api/admin/reset-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmPhrase,
          categories: Array.from(selectedCategories),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await res.json();
      if (res.ok) {
        setResult(data);
        setConfirmPhrase("");
        setSelectedCategories(new Set());
      } else {
        setError(data.error || "Reset failed");
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Request timed out. The reset may still be processing — please wait and check your data.");
      } else {
        setError("Network error — please check your connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-red-600">Reset Data</h1>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
        Select which data categories to delete. Your admin account is always preserved.
      </p>

      {/* Category checkboxes */}
      <div className="mt-4 space-y-1">
        <div className="mb-3 flex items-center gap-2 border-b border-[var(--border)] pb-2">
          <input
            type="checkbox"
            id="select-all"
            checked={allSelected}
            onChange={toggleAll}
            className="h-4 w-4 rounded accent-red-600"
          />
          <label htmlFor="select-all" className="text-sm font-semibold cursor-pointer">
            {allSelected ? "Deselect All" : "Select All"}
          </label>
          <span className="text-xs text-[var(--muted-foreground)]">
            ({selectedCategories.size}/{CATEGORIES.length} selected)
          </span>
        </div>

        {CATEGORIES.map((cat) => (
          <label
            key={cat.id}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
              selectedCategories.has(cat.id)
                ? "border-red-300 bg-red-50"
                : "border-[var(--border)] hover:bg-[var(--muted)]"
            }`}
          >
            <input
              type="checkbox"
              checked={selectedCategories.has(cat.id)}
              onChange={() => toggleCategory(cat.id)}
              className="mt-0.5 h-4 w-4 rounded accent-red-600"
            />
            <div>
              <span className="text-sm font-medium">{cat.label}</span>
              <p className="text-xs text-[var(--muted-foreground)]">{cat.description}</p>
            </div>
          </label>
        ))}
      </div>

      {/* Warning */}
      {!noneSelected && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-medium text-red-700">
            This will permanently delete {selectedCategories.size} data categor{selectedCategories.size === 1 ? "y" : "ies"}.
            {selectedCategories.has("institutions") && " You will need to recreate your institution after reset."}
            {selectedCategories.has("users") && " All user accounts (except yours) will be removed from Firebase Auth."}
          </p>
        </div>
      )}

      {/* Confirmation */}
      <div className="mt-4">
        <label className="block text-sm font-medium">
          Type <span className="font-mono font-bold text-red-600">DELETE ALL DATA</span> to confirm
        </label>
        <input
          type="text"
          value={confirmPhrase}
          onChange={(e) => setConfirmPhrase(e.target.value)}
          placeholder="DELETE ALL DATA"
          className="mt-1 w-full rounded-lg border border-red-300 bg-[var(--background)] px-3 py-2 text-sm"
          disabled={noneSelected}
        />
      </div>

      <button
        onClick={handleReset}
        disabled={!isConfirmed || loading}
        className="mt-4 rounded-lg bg-red-600 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading
          ? "Deleting... (this may take up to a minute)"
          : noneSelected
            ? "Select categories to delete"
            : `Delete ${selectedCategories.size} categor${selectedCategories.size === 1 ? "y" : "ies"}`}
      </button>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4">
          <h3 className="font-semibold text-green-700">Reset Complete</h3>
          <div className="mt-2 space-y-1">
            {Object.entries(
              (result as Record<string, unknown>).counts as Record<string, number>
            ).map(([key, count]) => (
              <div key={key} className="flex justify-between text-sm">
                <span className="capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                <span className="font-mono">{count} deleted</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => window.location.href = "/dashboard"}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => {
                setResult(null);
                setError(null);
              }}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--muted)]"
            >
              Reset More
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
