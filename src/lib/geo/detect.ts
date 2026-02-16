export interface GeoDetectionResult {
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  stateCode: string;
  country: string;
  countryCode: string;
  postalCode: string;
  timezone: string;
}

let cachedResult: GeoDetectionResult | null = null;
let fetchPromise: Promise<GeoDetectionResult | null> | null = null;

/**
 * Detect user's location via IP geolocation (ipapi.co).
 * Results are cached for the session to avoid repeated API calls.
 * Returns null on failure (silently).
 */
export async function detectUserLocation(
  signal?: AbortSignal
): Promise<GeoDetectionResult | null> {
  if (cachedResult) return cachedResult;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const res = await fetch("https://ipapi.co/json/", { signal });
      if (!res.ok) return null;
      const data = await res.json();

      cachedResult = {
        latitude: data.latitude,
        longitude: data.longitude,
        city: data.city || "",
        state: data.region || "",
        stateCode: data.region_code || "",
        country: data.country_name || "",
        countryCode: data.country || "",
        postalCode: data.postal || "",
        timezone: data.timezone || "",
      };
      return cachedResult;
    } catch {
      return null;
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}
