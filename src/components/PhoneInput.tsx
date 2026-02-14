"use client";

import { useEffect, useState } from "react";

const COUNTRIES = [
  { code: "+91", country: "IN", name: "India", flag: "\u{1F1EE}\u{1F1F3}" },
  { code: "+1", country: "US", name: "United States", flag: "\u{1F1FA}\u{1F1F8}" },
  { code: "+44", country: "GB", name: "United Kingdom", flag: "\u{1F1EC}\u{1F1E7}" },
  { code: "+971", country: "AE", name: "UAE", flag: "\u{1F1E6}\u{1F1EA}" },
  { code: "+966", country: "SA", name: "Saudi Arabia", flag: "\u{1F1F8}\u{1F1E6}" },
  { code: "+65", country: "SG", name: "Singapore", flag: "\u{1F1F8}\u{1F1EC}" },
  { code: "+61", country: "AU", name: "Australia", flag: "\u{1F1E6}\u{1F1FA}" },
  { code: "+49", country: "DE", name: "Germany", flag: "\u{1F1E9}\u{1F1EA}" },
  { code: "+33", country: "FR", name: "France", flag: "\u{1F1EB}\u{1F1F7}" },
  { code: "+81", country: "JP", name: "Japan", flag: "\u{1F1EF}\u{1F1F5}" },
  { code: "+86", country: "CN", name: "China", flag: "\u{1F1E8}\u{1F1F3}" },
  { code: "+82", country: "KR", name: "South Korea", flag: "\u{1F1F0}\u{1F1F7}" },
  { code: "+55", country: "BR", name: "Brazil", flag: "\u{1F1E7}\u{1F1F7}" },
  { code: "+234", country: "NG", name: "Nigeria", flag: "\u{1F1F3}\u{1F1EC}" },
  { code: "+254", country: "KE", name: "Kenya", flag: "\u{1F1F0}\u{1F1EA}" },
  { code: "+27", country: "ZA", name: "South Africa", flag: "\u{1F1FF}\u{1F1E6}" },
  { code: "+977", country: "NP", name: "Nepal", flag: "\u{1F1F3}\u{1F1F5}" },
  { code: "+880", country: "BD", name: "Bangladesh", flag: "\u{1F1E7}\u{1F1E9}" },
  { code: "+94", country: "LK", name: "Sri Lanka", flag: "\u{1F1F1}\u{1F1F0}" },
  { code: "+60", country: "MY", name: "Malaysia", flag: "\u{1F1F2}\u{1F1FE}" },
];

interface PhoneInputProps {
  value: string;
  onChange: (fullNumber: string) => void;
  required?: boolean;
  id?: string;
}

export default function PhoneInput({ value, onChange, required, id }: PhoneInputProps) {
  const [countryCode, setCountryCode] = useState("+91");
  const [number, setNumber] = useState("");
  const [geoDetected, setGeoDetected] = useState(false);

  // Parse value when it changes (handles async userData loading)
  useEffect(() => {
    if (!value) return;
    const match = COUNTRIES.find((c) => value.startsWith(c.code));
    if (match) {
      setCountryCode(match.code);
      setNumber(value.slice(match.code.length).trim());
    } else if (value.startsWith("+")) {
      setNumber(value);
    } else {
      setNumber(value);
    }
  }, [value]);

  // Geo-detect country on mount
  useEffect(() => {
    if (geoDetected) return;
    const controller = new AbortController();

    async function detectCountry() {
      try {
        const res = await fetch("https://ipapi.co/json/", {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        const match = COUNTRIES.find((c) => c.country === data.country_code);
        if (match && !value) {
          setCountryCode(match.code);
        }
        setGeoDetected(true);
      } catch {
        // Silently fail — default stays +91
      }
    }

    detectCountry();
    return () => controller.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleNumberChange(newNumber: string) {
    // Strip non-digit characters
    const digits = newNumber.replace(/\D/g, "");
    setNumber(digits);
    onChange(`${countryCode}${digits}`);
  }

  function handleCodeChange(newCode: string) {
    setCountryCode(newCode);
    onChange(`${newCode}${number}`);
  }

  const selectedCountry = COUNTRIES.find((c) => c.code === countryCode);

  return (
    <div className="flex gap-2">
      <select
        value={countryCode}
        onChange={(e) => handleCodeChange(e.target.value)}
        className="w-[130px] shrink-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-sm"
        aria-label="Country code"
      >
        {COUNTRIES.map((c) => (
          <option key={c.country} value={c.code}>
            {c.flag} {c.code}
          </option>
        ))}
      </select>
      <input
        id={id}
        type="tel"
        required={required}
        value={number}
        onChange={(e) => handleNumberChange(e.target.value)}
        placeholder={selectedCountry?.country === "IN" ? "9876543210" : "Phone number"}
        className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
      />
    </div>
  );
}
