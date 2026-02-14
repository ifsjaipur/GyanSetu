"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { doc, getDoc } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import type { Institution } from "@shared/types/institution";
import { INSTITUTION_COOKIE_NAME } from "@/lib/utils/constants";

interface InstitutionContextValue {
  institution: Institution | null;
  institutionId: string | null;
  loading: boolean;
}

const InstitutionContext = createContext<InstitutionContextValue>({
  institution: null,
  institutionId: null,
  loading: true,
});

function getInstitutionIdFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${INSTITUTION_COOKIE_NAME}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function applyBrandingColors(branding: Institution["branding"] | undefined) {
  if (!branding || typeof document === "undefined") return;
  const root = document.documentElement;
  const vars: [string, string | undefined][] = [
    ["--brand-primary", branding.primaryColor],
    ["--brand-secondary", branding.secondaryColor],
    ["--brand-accent", branding.accentColor],
    ["--brand-header-bg", branding.headerBgColor],
  ];
  for (const [prop, value] of vars) {
    if (value) root.style.setProperty(prop, value);
  }
}

function getInitialInstitution(institutionId: string | null): Institution | null {
  if (!institutionId || typeof window === "undefined") return null;
  try {
    const cached = sessionStorage.getItem(`inst_${institutionId}`);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 30 * 60 * 1000) {
        // Apply branding immediately to prevent theme flash
        applyBrandingColors((data as Institution).branding);
        return data as Institution;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export function InstitutionProvider({ children }: { children: ReactNode }) {
  const institutionId = getInstitutionIdFromCookie();
  const cachedInstitution = getInitialInstitution(institutionId);
  const [institution, setInstitution] = useState<Institution | null>(cachedInstitution);
  const [loading, setLoading] = useState(!cachedInstitution);

  useEffect(() => {
    async function fetchInstitution() {
      if (!institutionId) {
        setLoading(false);
        return;
      }

      // Skip fetch if we already loaded from cache synchronously
      if (cachedInstitution) return;

      try {
        const instDoc = await getDoc(doc(getClientDb(), "institutions", institutionId));
        if (instDoc.exists()) {
          const data = { id: instDoc.id, ...instDoc.data() } as Institution;
          setInstitution(data);
          applyBrandingColors(data.branding);
          try {
            sessionStorage.setItem(
              `inst_${institutionId}`,
              JSON.stringify({ data, timestamp: Date.now() })
            );
          } catch {
            // sessionStorage full or unavailable — ignore
          }
        }
      } catch (err) {
        console.error("Error fetching institution:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchInstitution();
  }, [institutionId, cachedInstitution]);

  // Apply branding when institution changes (e.g. admin updates branding)
  useEffect(() => {
    applyBrandingColors(institution?.branding);
  }, [institution]);

  return (
    <InstitutionContext.Provider
      value={{ institution, institutionId, loading }}
    >
      {children}
    </InstitutionContext.Provider>
  );
}

export function useInstitution(): InstitutionContextValue {
  return useContext(InstitutionContext);
}
