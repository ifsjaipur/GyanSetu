"use client";

import { useMemo } from "react";
import {
  getCountries,
  getStatesOfCountry,
  findCountryCode,
  findStateCode,
} from "@/lib/data/location";

interface LocationValue {
  country: string; // stored as country name
  countryCode?: string; // ISO code for dropdown
  state: string; // stored as state name
  stateCode?: string; // ISO code for dropdown
  city: string;
  timezone: string;
}

interface LocationFieldsProps {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
}

export default function LocationFields({ value, onChange }: LocationFieldsProps) {
  const countries = useMemo(() => getCountries(), []);

  // Resolve country code from name if not provided
  const countryCode = value.countryCode || findCountryCode(value.country);
  const states = useMemo(() => getStatesOfCountry(countryCode), [countryCode]);
  const stateCode = value.stateCode || findStateCode(countryCode, value.state);

  function handleCountryChange(code: string) {
    const country = countries.find((c) => c.code === code);
    onChange({
      ...value,
      country: country?.name || "",
      countryCode: code,
      state: "",
      stateCode: "",
    });
  }

  function handleStateChange(code: string) {
    const stateList = getStatesOfCountry(countryCode);
    const state = stateList.find((s) => s.code === code);
    onChange({
      ...value,
      state: state?.name || "",
      stateCode: code,
    });
  }

  const selectClass =
    "mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";
  const inputClass = selectClass;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div>
        <label className="block text-sm font-medium">Country</label>
        <select
          value={countryCode}
          onChange={(e) => handleCountryChange(e.target.value)}
          className={selectClass}
        >
          <option value="">Select country...</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium">State</label>
        {states.length > 0 ? (
          <select
            value={stateCode}
            onChange={(e) => handleStateChange(e.target.value)}
            className={selectClass}
          >
            <option value="">Select state...</option>
            {states.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={value.state}
            onChange={(e) => onChange({ ...value, state: e.target.value })}
            placeholder="State / Province"
            className={inputClass}
          />
        )}
      </div>
      <div>
        <label className="block text-sm font-medium">City</label>
        <input
          type="text"
          value={value.city}
          onChange={(e) => onChange({ ...value, city: e.target.value })}
          placeholder="City"
          className={inputClass}
        />
      </div>
    </div>
  );
}
