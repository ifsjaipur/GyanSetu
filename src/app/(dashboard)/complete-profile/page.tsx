"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useInstitution } from "@/contexts/InstitutionContext";
import PhoneInput from "@/components/PhoneInput";
import LocationFields from "@/components/LocationFields";
import { findCountryCode, findStateCode } from "@/lib/data/location";
import { detectUserLocation } from "@/lib/geo/detect";
import { haversineDistanceKm } from "@/lib/geo/distance";
import { properCaseName, trimWhitespace } from "@/lib/utils/normalize";

interface BrowseInstitution {
  id: string;
  name: string;
  location?: { city?: string; state?: string; country?: string; lat?: number | null; lng?: number | null };
  branding?: { institutionTagline?: string };
}

export default function CompleteProfilePage() {
  const { firebaseUser, userData, refreshUser } = useAuth();
  const { institution } = useInstitution();
  const router = useRouter();

  // Institution selection state
  const [institutions, setInstitutions] = useState<BrowseInstitution[]>([]);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showInviteCode, setShowInviteCode] = useState(false);

  const [form, setForm] = useState({
    displayName: userData?.displayName || "",
    gender: userData?.gender || "",
    dateOfBirth: userData?.profile?.dateOfBirth || "",
    phone: userData?.phone || "",
    address: {
      address: userData?.address?.address || "",
      city: userData?.address?.city || "",
      state: userData?.address?.state || "",
      country: userData?.address?.country || "",
      pincode: userData?.address?.pincode || "",
    },
    consent: false,
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoDetecting, setGeoDetecting] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Fetch browseable institutions for users without an institution
  useEffect(() => {
    if (userData?.institutionId) return; // already has an institution
    async function fetchInstitutions() {
      try {
        const res = await fetch("/api/institutions?browse=true");
        if (res.ok) {
          const data = await res.json();
          setInstitutions(data.institutions || []);
        }
      } catch { /* ignore */ }
    }
    fetchInstitutions();
  }, [userData?.institutionId]);

  // Auto-detect user location via IP geolocation
  useEffect(() => {
    const controller = new AbortController();
    setGeoDetecting(true);

    detectUserLocation(controller.signal).then((geo) => {
      if (!geo) {
        setGeoDetecting(false);
        return;
      }
      setUserCoords({ lat: geo.latitude, lng: geo.longitude });

      // Pre-fill address fields from detection (only empty fields)
      setForm((f) => ({
        ...f,
        address: {
          ...f.address,
          city: f.address.city || geo.city,
          state: f.address.state || geo.state,
          country: f.address.country || geo.country,
          pincode: f.address.pincode || geo.postalCode,
        },
      }));
      setGeoDetecting(false);
    });

    return () => controller.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sort institutions by proximity to detected user location
  const sortedInstitutions = useMemo(() => {
    if (!userCoords || institutions.length === 0) return institutions;

    return [...institutions].sort((a, b) => {
      const aLat = a.location?.lat;
      const aLng = a.location?.lng;
      const bLat = b.location?.lat;
      const bLng = b.location?.lng;

      if (aLat == null || aLng == null) return 1;
      if (bLat == null || bLng == null) return -1;

      const distA = haversineDistanceKm(userCoords.lat, userCoords.lng, aLat, aLng);
      const distB = haversineDistanceKm(userCoords.lat, userCoords.lng, bLat, bLng);
      return distA - distB;
    });
  }, [institutions, userCoords]);

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
    if (!form.gender) {
      setError("Gender is required.");
      return;
    }
    if (!form.dateOfBirth) {
      setError("Date of birth is required.");
      return;
    }
    if (!form.phone.trim() || form.phone.length < 10) {
      setError("A valid WhatsApp number is required.");
      return;
    }
    if (!form.address.address.trim()) {
      setError("Address is required.");
      return;
    }
    if (
      !form.address.city.trim() ||
      !form.address.state.trim() ||
      !form.address.country.trim() ||
      !form.address.pincode.trim()
    ) {
      setError("All address fields (city, state, country, pincode) are required.");
      return;
    }
    if (form.address.pincode.trim().length < 4) {
      setError("Pincode must be at least 4 characters.");
      return;
    }
    if (guardianRequired && (!guardianForm.name.trim() || !guardianForm.phone.trim())) {
      setError("Parent/Guardian name and phone are required for students under 13 years of age.");
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
        gender: form.gender,
        phone: form.phone.trim(),
        address: {
          address: form.address.address.trim(),
          city: form.address.city.trim(),
          state: form.address.state.trim(),
          country: form.address.country.trim(),
          pincode: form.address.pincode.trim(),
        },
        "profile.dateOfBirth": form.dateOfBirth,
        consentGiven: true,
        consentGivenAt: serverTimestamp(),
        profileComplete: true,
        updatedAt: serverTimestamp(),
      };

      // Include parent/guardian info if provided (or required for under-13)
      if ((showGuardian || guardianRequired) && guardianForm.name.trim() && guardianForm.phone.trim()) {
        updateData.parentGuardian = {
          name: guardianForm.name.trim(),
          phone: guardianForm.phone.trim(),
          email: guardianForm.email.trim() || null,
          address: guardianForm.address.trim() || null,
          relation: guardianForm.relation,
        };
      }

      await setDoc(doc(db, "users", firebaseUser.uid), updateData, { merge: true });

      // If user selected an institution, create a membership request
      if (selectedInstitutionId && !userData?.institutionId) {
        try {
          const body: Record<string, string> = {
            institutionId: selectedInstitutionId,
            joinMethod: inviteCode.trim() ? "invite_code" : "browse",
          };
          if (inviteCode.trim()) body.inviteCode = inviteCode.trim();

          const memberRes = await fetch("/api/memberships", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

          if (!memberRes.ok) {
            const memberData = await memberRes.json();
            // Don't block profile completion — just warn
            console.warn("Membership request failed:", memberData.error);
          }
        } catch {
          console.warn("Membership request failed (network error)");
        }
      }

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
              onBlur={(e) =>
                setForm((f) => ({ ...f, displayName: properCaseName(e.target.value) }))
              }
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              placeholder="Enter your full name"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium" htmlFor="gender">
                Gender *
              </label>
              <select
                id="gender"
                required
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
              <label className="block text-sm font-medium" htmlFor="dateOfBirth">
                Date of Birth *
              </label>
              <input
                id="dateOfBirth"
                type="date"
                required
                value={form.dateOfBirth}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dateOfBirth: e.target.value }))
                }
                max={new Date().toISOString().split("T")[0]}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
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
              WhatsApp Number *
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
            <legend className="text-sm font-medium">
              Address *
              {geoDetecting && (
                <span className="ml-2 text-xs font-normal text-[var(--muted-foreground)]">
                  (Detecting your location...)
                </span>
              )}
            </legend>
            <div>
              <label className="block text-sm font-medium" htmlFor="address">
                Address *
              </label>
              <input
                id="address"
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
            <div className="max-w-[200px]">
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
          </fieldset>

          {/* Institution Selection (for users without an institution) */}
          {!userData?.institutionId && institutions.length > 0 && (
            <fieldset className="space-y-3 border-t border-[var(--border)] pt-4">
              <legend className="text-sm font-medium">
                Select an Institution{" "}
                <span className="font-normal text-[var(--muted-foreground)]">(Optional)</span>
              </legend>
              <p className="text-xs text-[var(--muted-foreground)]">
                You can join an institution now or do it later from your dashboard.
              </p>
              <select
                value={selectedInstitutionId}
                onChange={(e) => {
                  setSelectedInstitutionId(e.target.value);
                  setShowInviteCode(false);
                  setInviteCode("");
                }}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                <option value="">Skip for now</option>
                {sortedInstitutions.map((inst) => {
                  const distance =
                    userCoords && inst.location?.lat != null && inst.location?.lng != null
                      ? haversineDistanceKm(userCoords.lat, userCoords.lng, inst.location.lat, inst.location.lng)
                      : null;

                  return (
                    <option key={inst.id} value={inst.id}>
                      {inst.name}
                      {inst.location?.city ? ` — ${inst.location.city}` : ""}
                      {inst.location?.state ? `, ${inst.location.state}` : ""}
                      {distance != null ? ` (~${Math.round(distance)} km)` : ""}
                    </option>
                  );
                })}
              </select>

              {selectedInstitutionId && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowInviteCode(!showInviteCode)}
                    className="text-xs text-[var(--brand-primary)] hover:underline"
                  >
                    {showInviteCode ? "Hide invite code" : "Have an invite code?"}
                  </button>
                  {showInviteCode && (
                    <input
                      type="text"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="Enter invite code (optional)"
                      className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                    />
                  )}
                </div>
              )}
            </fieldset>
          )}

          {/* Parent/Guardian Section */}
          <div className="border-t border-[var(--border)] pt-4">
            {guardianRequired ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-[var(--card-foreground)]">
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
                className="flex items-center gap-2 text-sm font-medium text-[var(--card-foreground)]"
              >
                <span>{showGuardian ? "▼" : "▶"}</span>
                Parent / Guardian Information
                <span className="text-xs font-normal text-[var(--muted-foreground)]">(Optional)</span>
              </button>
            )}
            {showGuardian && (
              <div className="mt-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium" htmlFor="guardianName">
                      Name {guardianRequired || guardianForm.phone ? "*" : ""}
                    </label>
                    <input
                      id="guardianName"
                      type="text"
                      value={guardianForm.name}
                      onChange={(e) =>
                        setGuardianForm((f) => ({ ...f, name: e.target.value }))
                      }
                      onBlur={(e) =>
                        setGuardianForm((f) => ({ ...f, name: properCaseName(e.target.value) }))
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
                    Phone {guardianRequired || guardianForm.name ? "*" : ""}
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
              I agree to share my name, email, and phone number
              {institution?.name || selectedInstitutionId
                ? <> with <strong>{institution?.name || institutions.find(i => i.id === selectedInstitutionId)?.name || "the selected institution"}</strong></>
                : null}{" "}
              for enrollment and communication purposes.
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
