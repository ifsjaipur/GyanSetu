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

export function InstitutionProvider({ children }: { children: ReactNode }) {
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [loading, setLoading] = useState(true);
  const institutionId = getInstitutionIdFromCookie();

  useEffect(() => {
    async function fetchInstitution() {
      if (!institutionId) {
        setLoading(false);
        return;
      }

      try {
        const instDoc = await getDoc(doc(getClientDb(), "institutions", institutionId));
        if (instDoc.exists()) {
          setInstitution({ id: instDoc.id, ...instDoc.data() } as Institution);
        }
      } catch (err) {
        console.error("Error fetching institution:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchInstitution();
  }, [institutionId]);

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
