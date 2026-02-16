import { Country, State } from "country-state-city";

export interface CountryOption {
  code: string;
  name: string;
}

export interface StateOption {
  code: string;
  name: string;
}

export function getCountries(): CountryOption[] {
  return Country.getAllCountries().map((c) => ({
    code: c.isoCode,
    name: c.name,
  }));
}

export function getStatesOfCountry(countryCode: string): StateOption[] {
  if (!countryCode) return [];
  return State.getStatesOfCountry(countryCode).map((s) => ({
    code: s.isoCode,
    name: s.name,
  }));
}

/**
 * Find the country code from a country name (case-insensitive).
 * Useful for converting existing free-text country values to codes.
 */
export function findCountryCode(countryName: string): string {
  if (!countryName) return "";
  const lower = countryName.toLowerCase();
  const match = Country.getAllCountries().find(
    (c) => c.name.toLowerCase() === lower || c.isoCode.toLowerCase() === lower
  );
  return match?.isoCode || "";
}

/**
 * Find the state code from a state name within a country (case-insensitive).
 */
export function findStateCode(countryCode: string, stateName: string): string {
  if (!countryCode || !stateName) return "";
  const lower = stateName.toLowerCase();
  const match = State.getStatesOfCountry(countryCode).find(
    (s) => s.name.toLowerCase() === lower || s.isoCode.toLowerCase() === lower
  );
  return match?.isoCode || "";
}
