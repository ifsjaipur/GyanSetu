"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useInstitution } from "@/contexts/InstitutionContext";

export default function CompleteProfilePage() {
  const { firebaseUser, userData, refreshUser } = useAuth();
  const { institution } = useInstitution();
  const router = useRouter();

  const [form, setForm] = useState({
    displayName: userData?.displayName || "",
    phone: userData?.phone || "",
    consent: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if profile already complete
  if (userData?.profileComplete) {
    router.push("/dashboard");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firebaseUser) return;

    if (!form.displayName.trim()) {
      setError("Name is required.");
      return;
    }
    if (!form.phone.trim() || form.phone.length < 10) {
      setError("A valid phone number is required.");
      return;
    }
    if (!form.consent) {
      setError("You must agree to share your information.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const db = getClientDb();
      await updateDoc(doc(db, "users", firebaseUser.uid), {
        displayName: form.displayName.trim(),
        phone: form.phone.trim(),
        consentGiven: true,
        consentGivenAt: serverTimestamp(),
        profileComplete: true,
        updatedAt: serverTimestamp(),
      });

      await refreshUser();
      router.push("/dashboard");
    } catch (err) {
      console.error("Profile update failed:", err);
      setError("Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-8">
        <h1 className="text-xl font-bold text-[var(--card-foreground)]">
          Complete Your Profile
        </h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          Please provide your details to continue using the platform.
        </p>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium" htmlFor="name">
              Full Name *
            </label>
            <input
              id="name"
              type="text"
              required
              value={form.displayName}
              onChange={(e) =>
                setForm((f) => ({ ...f, displayName: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              placeholder="Enter your full name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              disabled
              value={firebaseUser?.email || ""}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-sm text-[var(--muted-foreground)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium" htmlFor="phone">
              Phone Number *
            </label>
            <input
              id="phone"
              type="tel"
              required
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              placeholder="+91 9876543210"
            />
          </div>

          <div className="flex items-start gap-2 pt-2">
            <input
              id="consent"
              type="checkbox"
              checked={form.consent}
              onChange={(e) =>
                setForm((f) => ({ ...f, consent: e.target.checked }))
              }
              className="mt-0.5 h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="consent" className="text-sm">
              I agree to share my name, email, and phone number with{" "}
              <strong>{institution?.name || "this institution"}</strong> for
              enrollment and communication purposes.
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            {loading ? "Saving..." : "Continue"}
          </button>
        </form>
      </div>
    </main>
  );
}
