"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResetDataPage() {
  const router = useRouter();
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isConfirmed = confirmPhrase === "DELETE ALL DATA";

  async function handleReset() {
    if (!isConfirmed) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/admin/reset-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmPhrase }),
      });

      const data = await res.json();
      if (res.ok) {
        setResult(data);
        setConfirmPhrase("");
      } else {
        setError(data.error || "Reset failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold text-red-600">Reset All Data</h1>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
        This will permanently delete ALL data for your institution, including:
      </p>
      <ul className="mt-2 space-y-1 text-sm text-[var(--muted-foreground)]">
        <li>All courses, modules, lessons, and sessions</li>
        <li>All users (except your admin account) and their Firebase Auth accounts</li>
        <li>All enrollments and payment records</li>
        <li>All attendance, certificates, exams, and progress data</li>
      </ul>

      <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-medium text-red-700">
          Your institution configuration and your admin account will be preserved.
        </p>
      </div>

      <div className="mt-6">
        <label className="block text-sm font-medium">
          Type <span className="font-mono font-bold text-red-600">DELETE ALL DATA</span> to confirm
        </label>
        <input
          type="text"
          value={confirmPhrase}
          onChange={(e) => setConfirmPhrase(e.target.value)}
          placeholder="DELETE ALL DATA"
          className="mt-1 w-full rounded-lg border border-red-300 bg-[var(--background)] px-3 py-2 text-sm"
        />
      </div>

      <button
        onClick={handleReset}
        disabled={!isConfirmed || loading}
        className="mt-4 rounded-lg bg-red-600 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Deleting..." : "Reset All Data"}
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
            {Object.entries((result as Record<string, unknown>).counts as Record<string, number>).map(([key, count]) => (
              <div key={key} className="flex justify-between text-sm">
                <span className="capitalize">{key}</span>
                <span className="font-mono">{count} deleted</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-4 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            Go to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
