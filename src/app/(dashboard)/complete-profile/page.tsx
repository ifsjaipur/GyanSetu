"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useInstitution } from "@/contexts/InstitutionContext";
import PhoneInput from "@/components/PhoneInput";

export default function CompleteProfilePage() {
  const { firebaseUser, userData, refreshUser } = useAuth();
  const { institution } = useInstitution();
  const router = useRouter();

  const [form, setForm] = useState({
    displayName: userData?.displayName || "",
    phone: userData?.phone || "",
    address: {
      city: userData?.address?.city || "",
      state: userData?.address?.state || "",
      country: userData?.address?.country || "India",
      pincode: userData?.address?.pincode || "",
    },
    consent: false,
  });
  const [showGuardian, setShowGuardian] = useState(false);
  const [guardianForm, setGuardianForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    relation: "father",
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
    if (
      !form.address.city.trim() ||
      !form.address.state.trim() ||
      !form.address.country.trim() ||
      !form.address.pincode.trim()
    ) {
      setError("All address fields are required.");
      return;
    }
    if (form.address.pincode.trim().length < 4) {
      setError("Pincode must be at least 4 characters.");
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
      const updateData: Record<string, unknown> = {
        displayName: form.displayName.trim(),
        phone: form.phone.trim(),
        address: {
          city: form.address.city.trim(),
          state: form.address.state.trim(),
          country: form.address.country.trim(),
          pincode: form.address.pincode.trim(),
        },
        consentGiven: true,
        consentGivenAt: serverTimestamp(),
        profileComplete: true,
        updatedAt: serverTimestamp(),
      };

      // Include parent/guardian info if provided
      if (showGuardian && guardianForm.name.trim() && guardianForm.phone.trim()) {
        updateData.parentGuardian = {
          name: guardianForm.name.trim(),
          phone: guardianForm.phone.trim(),
          email: guardianForm.email.trim() || null,
          address: guardianForm.address.trim() || null,
          relation: guardianForm.relation,
        };
      }

      await setDoc(doc(db, "users", firebaseUser.uid), updateData, { merge: true });

      await refreshUser();
      // Domain users already have an institutionId — go to dashboard.
      // External users need to select/join an institution first.
      if (userData?.institutionId) {
        router.push("/dashboard");
      } else {
        router.push("/select-institution");
      }
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
        {/* Google profile photo */}
        {firebaseUser?.photoURL && (
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={firebaseUser.photoURL}
              alt="Profile"
              className="h-16 w-16 rounded-full border-2 border-[var(--border)] object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        )}

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
            <div className="mt-1">
              <PhoneInput
                id="phone"
                required
                value={form.phone}
                onChange={(val) => setForm((f) => ({ ...f, phone: val }))}
              />
            </div>
          </div>

          {/* Address Section */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Address *</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium" htmlFor="country">
                  Country *
                </label>
                <input
                  id="country"
                  type="text"
                  required
                  value={form.address.country}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      address: { ...f.address, country: e.target.value },
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  placeholder="Country"
                />
              </div>
              <div>
                <label className="block text-sm font-medium" htmlFor="state">
                  State *
                </label>
                <input
                  id="state"
                  type="text"
                  required
                  value={form.address.state}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      address: { ...f.address, state: e.target.value },
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  placeholder="State"
                />
              </div>
              <div>
                <label className="block text-sm font-medium" htmlFor="city">
                  City *
                </label>
                <input
                  id="city"
                  type="text"
                  required
                  value={form.address.city}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      address: { ...f.address, city: e.target.value },
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  placeholder="City"
                />
              </div>
              <div>
                <label className="block text-sm font-medium" htmlFor="pincode">
                  Pincode *
                </label>
                <input
                  id="pincode"
                  type="text"
                  required
                  minLength={4}
                  value={form.address.pincode}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      address: { ...f.address, pincode: e.target.value },
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  placeholder="Pincode"
                />
              </div>
            </div>
          </fieldset>

          {/* Parent/Guardian Section */}
          <div className="border-t border-[var(--border)] pt-4">
            <button
              type="button"
              onClick={() => setShowGuardian(!showGuardian)}
              className="flex items-center gap-2 text-sm font-medium text-[var(--card-foreground)]"
            >
              <span>{showGuardian ? "▼" : "▶"}</span>
              Parent / Guardian Information
              <span className="text-xs font-normal text-[var(--muted-foreground)]">(Optional)</span>
            </button>
            {showGuardian && (
              <div className="mt-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium" htmlFor="guardianName">
                      Name {showGuardian && guardianForm.phone ? "*" : ""}
                    </label>
                    <input
                      id="guardianName"
                      type="text"
                      value={guardianForm.name}
                      onChange={(e) =>
                        setGuardianForm((f) => ({ ...f, name: e.target.value }))
                      }
                      className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                      placeholder="Guardian's full name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium" htmlFor="guardianRelation">
                      Relation
                    </label>
                    <select
                      id="guardianRelation"
                      value={guardianForm.relation}
                      onChange={(e) =>
                        setGuardianForm((f) => ({ ...f, relation: e.target.value }))
                      }
                      className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                    >
                      <option value="father">Father</option>
                      <option value="mother">Mother</option>
                      <option value="guardian">Guardian</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium" htmlFor="guardianPhone">
                    Phone {showGuardian && guardianForm.name ? "*" : ""}
                  </label>
                  <div className="mt-1">
                    <PhoneInput
                      id="guardianPhone"
                      value={guardianForm.phone}
                      onChange={(val) => setGuardianForm((f) => ({ ...f, phone: val }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium" htmlFor="guardianEmail">
                    Email
                  </label>
                  <input
                    id="guardianEmail"
                    type="email"
                    value={guardianForm.email}
                    onChange={(e) =>
                      setGuardianForm((f) => ({ ...f, email: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                    placeholder="guardian@email.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium" htmlFor="guardianAddress">
                    Address
                  </label>
                  <textarea
                    id="guardianAddress"
                    rows={2}
                    value={guardianForm.address}
                    onChange={(e) =>
                      setGuardianForm((f) => ({ ...f, address: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                    placeholder="Full address"
                  />
                </div>
              </div>
            )}
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
