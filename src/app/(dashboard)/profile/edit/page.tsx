"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import PhoneInput from "@/components/PhoneInput";

export default function ProfileEditPage() {
  const { firebaseUser, userData, refreshUser } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    displayName: "",
    phone: "",
    photoUrl: "",
  });
  const [showGuardian, setShowGuardian] = useState(false);
  const [guardianForm, setGuardianForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    relation: "father",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (userData) {
      setForm({
        displayName: userData.displayName || "",
        phone: userData.phone || "",
        photoUrl: userData.photoUrl || firebaseUser?.photoURL || "",
      });
      if (userData.parentGuardian) {
        setShowGuardian(true);
        setGuardianForm({
          name: userData.parentGuardian.name || "",
          phone: userData.parentGuardian.phone || "",
          email: userData.parentGuardian.email || "",
          address: userData.parentGuardian.address || "",
          relation: userData.parentGuardian.relation || "father",
        });
      }
    }
  }, [userData, firebaseUser?.photoURL]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!firebaseUser) return;

    if (!form.displayName.trim()) {
      setMessage("Error: Name is required.");
      return;
    }
    if (!form.phone.trim() || form.phone.replace(/\D/g, "").length < 10) {
      setMessage("Error: A valid phone number is required.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const db = getClientDb();
      const updateData: Record<string, unknown> = {
        displayName: form.displayName.trim(),
        phone: form.phone.trim(),
        photoUrl: form.photoUrl.trim() || null,
        updatedAt: serverTimestamp(),
      };

      if (showGuardian && guardianForm.name.trim() && guardianForm.phone.trim()) {
        updateData.parentGuardian = {
          name: guardianForm.name.trim(),
          phone: guardianForm.phone.trim(),
          email: guardianForm.email.trim() || null,
          address: guardianForm.address.trim() || null,
          relation: guardianForm.relation,
        };
      } else if (!showGuardian) {
        updateData.parentGuardian = null;
      }

      await setDoc(doc(db, "users", firebaseUser.uid), updateData, { merge: true });
      await refreshUser();
      setMessage("Profile updated successfully");
    } catch (err) {
      console.error("Profile update failed:", err);
      setMessage("Error: Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  const photoSrc = form.photoUrl || firebaseUser?.photoURL;

  return (
    <div className="max-w-lg">
      <button
        onClick={() => router.back()}
        className="mb-4 text-sm text-[var(--muted-foreground)] hover:underline"
      >
        &larr; Back
      </button>

      <h1 className="text-xl font-bold">Edit Profile</h1>

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

      <form onSubmit={handleSave} className="mt-6 space-y-5">
        {/* Photo */}
        <div className="flex items-center gap-4">
          {photoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoSrc}
              alt="Profile"
              className="h-16 w-16 rounded-full border-2 border-[var(--border)] object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--brand-primary)] text-lg font-bold text-white">
              {(form.displayName || "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <label className="block text-sm font-medium">Photo URL</label>
            <input
              type="url"
              value={form.photoUrl}
              onChange={(e) => setForm((f) => ({ ...f, photoUrl: e.target.value }))}
              placeholder="https://... (or leave empty for Google photo)"
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium">Full Name *</label>
          <input
            type="text"
            required
            value={form.displayName}
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </div>

        {/* Email (read-only) */}
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input
            type="email"
            disabled
            value={firebaseUser?.email || ""}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-sm text-[var(--muted-foreground)]"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium">Phone Number *</label>
          <div className="mt-1">
            <PhoneInput
              required
              value={form.phone}
              onChange={(val) => setForm((f) => ({ ...f, phone: val }))}
            />
          </div>
        </div>

        {/* Parent / Guardian */}
        <div className="border-t border-[var(--border)] pt-4">
          <button
            type="button"
            onClick={() => setShowGuardian(!showGuardian)}
            className="flex items-center gap-2 text-sm font-medium"
          >
            <span>{showGuardian ? "\u25BC" : "\u25B6"}</span>
            Parent / Guardian Information
            <span className="text-xs font-normal text-[var(--muted-foreground)]">(Optional)</span>
          </button>
          {showGuardian && (
            <div className="mt-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">Name</label>
                  <input
                    type="text"
                    value={guardianForm.name}
                    onChange={(e) => setGuardianForm((f) => ({ ...f, name: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                    placeholder="Guardian's full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Relation</label>
                  <select
                    value={guardianForm.relation}
                    onChange={(e) => setGuardianForm((f) => ({ ...f, relation: e.target.value }))}
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
                <label className="block text-sm font-medium">Phone</label>
                <div className="mt-1">
                  <PhoneInput
                    value={guardianForm.phone}
                    onChange={(val) => setGuardianForm((f) => ({ ...f, phone: val }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={guardianForm.email}
                  onChange={(e) => setGuardianForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  placeholder="guardian@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Address</label>
                <textarea
                  rows={2}
                  value={guardianForm.address}
                  onChange={(e) => setGuardianForm((f) => ({ ...f, address: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  placeholder="Full address"
                />
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--brand-primary)" }}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
