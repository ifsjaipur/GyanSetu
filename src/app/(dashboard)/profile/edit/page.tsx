"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useInstitution } from "@/contexts/InstitutionContext";
import { properCaseName, trimWhitespace } from "@/lib/utils/normalize";
import PhoneInput from "@/components/PhoneInput";
import LocationFields from "@/components/LocationFields";
import { findCountryCode, findStateCode } from "@/lib/data/location";
import Link from "next/link";

export default function ProfileEditPage() {
  const { firebaseUser, userData, memberships, refreshUser } = useAuth();
  const { institution } = useInstitution();
  const router = useRouter();

  const [form, setForm] = useState({
    displayName: "",
    gender: "",
    dateOfBirth: "",
    phone: "",
    photoUrl: "",
    address: {
      address: "",
      city: "",
      state: "",
      country: "",
      pincode: "",
    },
  });
  const [showGuardian, setShowGuardian] = useState(false);

  // Calculate age from DOB for guardian requirement
  const userAge = useMemo(() => {
    if (!form.dateOfBirth) return null;
    const dob = new Date(form.dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  }, [form.dateOfBirth]);

  const guardianRequired = userAge !== null && userAge < 13;

  // Auto-expand guardian section when required
  useEffect(() => {
    if (guardianRequired) setShowGuardian(true);
  }, [guardianRequired]);
  const [guardianForm, setGuardianForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    relation: "father",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Fetch fresh user data directly from Firestore (avoid stale AuthContext cache)
  useEffect(() => {
    async function loadProfile() {
      if (!firebaseUser) return;
      try {
        const userDoc = await getDoc(doc(getClientDb(), "users", firebaseUser.uid));
        const data = userDoc.data();
        if (data) {
          setForm({
            displayName: data.displayName || "",
            gender: data.gender || "",
            dateOfBirth: data.profile?.dateOfBirth || "",
            phone: data.phone || "",
            photoUrl: data.photoUrl || firebaseUser.photoURL || "",
            address: {
              address: data.address?.address || "",
              city: data.address?.city || "",
              state: data.address?.state || "",
              country: data.address?.country || "",
              pincode: data.address?.pincode || "",
            },
          });
          if (data.parentGuardian) {
            setShowGuardian(true);
            setGuardianForm({
              name: data.parentGuardian.name || "",
              phone: data.parentGuardian.phone || "",
              email: data.parentGuardian.email || "",
              address: data.parentGuardian.address || "",
              relation: data.parentGuardian.relation || "father",
            });
          }
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      }
    }
    loadProfile();
  }, [firebaseUser]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!firebaseUser) return;

    if (!form.displayName.trim()) {
      setMessage("Error: Name is required.");
      return;
    }
    if (!form.phone.trim() || form.phone.replace(/\D/g, "").length < 10) {
      setMessage("Error: A valid WhatsApp number is required.");
      return;
    }
    if (guardianRequired && (!guardianForm.name.trim() || !guardianForm.phone.trim())) {
      setMessage("Error: Parent/Guardian name and phone are required for students under 13 years of age.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const db = getClientDb();
      const updateData: Record<string, unknown> = {
        displayName: form.displayName.trim(),
        gender: form.gender || null,
        phone: form.phone.trim(),
        photoUrl: form.photoUrl.trim() || null,
        address: {
          address: form.address.address.trim(),
          city: form.address.city.trim(),
          state: form.address.state.trim(),
          country: form.address.country.trim(),
          pincode: form.address.pincode.trim(),
        },
        "profile.dateOfBirth": form.dateOfBirth || null,
        updatedAt: serverTimestamp(),
      };

      if ((showGuardian || guardianRequired) && guardianForm.name.trim() && guardianForm.phone.trim()) {
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
            onBlur={(e) => setForm((f) => ({ ...f, displayName: properCaseName(e.target.value) }))}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </div>

        {/* Gender & DOB */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Gender</label>
            <select
              value={form.gender}
              onChange={(e) =>
                setForm((f) => ({ ...f, gender: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Date of Birth</label>
            <input
              type="date"
              value={form.dateOfBirth}
              onChange={(e) =>
                setForm((f) => ({ ...f, dateOfBirth: e.target.value }))
              }
              max={new Date().toISOString().split("T")[0]}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
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
          <label className="block text-sm font-medium">WhatsApp Number *</label>
          <div className="mt-1">
            <PhoneInput
              required
              value={form.phone}
              onChange={(val) => setForm((f) => ({ ...f, phone: val }))}
            />
          </div>
        </div>

        {/* Address */}
        <div className="border-t border-[var(--border)] pt-4">
          <h3 className="mb-3 text-sm font-medium">Address</h3>
          <div className="mb-3">
            <label className="block text-sm font-medium">Address *</label>
            <input
              type="text"
              required
              value={form.address.address}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  address: { ...f.address, address: e.target.value },
                }))
              }
              onBlur={(e) =>
                setForm((f) => ({
                  ...f,
                  address: { ...f.address, address: trimWhitespace(e.target.value) },
                }))
              }
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              placeholder="House/Flat no., Street, Locality"
            />
          </div>
          <LocationFields
            value={{
              country: form.address.country,
              countryCode: findCountryCode(form.address.country),
              state: form.address.state,
              stateCode: findStateCode(
                findCountryCode(form.address.country),
                form.address.state
              ),
              city: form.address.city,
            }}
            onChange={(loc) =>
              setForm((f) => ({
                ...f,
                address: {
                  ...f.address,
                  country: loc.country,
                  state: loc.state,
                  city: loc.city,
                },
              }))
            }
          />
          <div className="mt-3 max-w-[200px]">
            <label className="block text-sm font-medium">Pincode</label>
            <input
              type="text"
              value={form.address.pincode}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  address: { ...f.address, pincode: e.target.value },
                }))
              }
              onBlur={(e) =>
                setForm((f) => ({
                  ...f,
                  address: { ...f.address, pincode: trimWhitespace(e.target.value) },
                }))
              }
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              placeholder="Pincode"
            />
          </div>
        </div>

        {/* Institution Info */}
        <div className="border-t border-[var(--border)] pt-4">
          <label className="block text-sm font-medium">Institution</label>
          {institution || userData?.institutionId ? (
            <div className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-sm">
              <span className="font-medium">{institution?.name || userData?.institutionId}</span>
              {userData?.role && (
                <span className="ml-2 text-xs text-[var(--muted-foreground)]">
                  ({userData.role.replace(/_/g, " ")})
                </span>
              )}
            </div>
          ) : memberships.some((m) => m.status === "pending") ? (
            <div className="mt-1 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-700">
              Membership request pending approval
            </div>
          ) : (
            <div className="mt-1">
              <p className="text-sm text-[var(--muted-foreground)]">No institution joined yet.</p>
              <Link
                href="/select-institution"
                className="mt-1 inline-block text-sm font-medium text-[var(--brand-primary)] hover:underline"
              >
                Browse and join an institution
              </Link>
            </div>
          )}
        </div>

        {/* Parent / Guardian */}
        <div className="border-t border-[var(--border)] pt-4">
          {guardianRequired ? (
            <div className="space-y-1">
              <p className="text-sm font-medium">
                Parent / Guardian Information *
              </p>
              <p className="text-xs text-amber-600">
                Parent/Guardian information is required for students under 13 years of age.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowGuardian(!showGuardian)}
              className="flex items-center gap-2 text-sm font-medium"
            >
              <span>{showGuardian ? "\u25BC" : "\u25B6"}</span>
              Parent / Guardian Information
              <span className="text-xs font-normal text-[var(--muted-foreground)]">(Optional)</span>
            </button>
          )}
          {showGuardian && (
            <div className="mt-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">Name {guardianRequired ? "*" : ""}</label>
                  <input
                    type="text"
                    value={guardianForm.name}
                    onChange={(e) => setGuardianForm((f) => ({ ...f, name: e.target.value }))}
                    onBlur={(e) => setGuardianForm((f) => ({ ...f, name: properCaseName(e.target.value) }))}
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
                <label className="block text-sm font-medium">Phone {guardianRequired ? "*" : ""}</label>
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
