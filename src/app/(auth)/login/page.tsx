"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithGoogle, createSessionCookie } from "@/lib/firebase/auth";
import { APP_NAME } from "@/lib/utils/constants";
import DynamicLoginGlobe from "@/components/login/DynamicLoginGlobe";

function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);

    try {
      await signInWithGoogle();
      await createSessionCookie();
      router.push(redirectTo);
    } catch (err) {
      console.error("Sign-in error:", err);
      setError("Failed to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex w-full flex-col justify-center px-8 sm:px-12">
      <div className="mb-10">
        <h2 className="text-3xl font-bold text-[#ccd6f6]">Welcome Back</h2>
        <p className="mt-2 text-sm text-[#8892b0]">
          Sign in with your Google account to access the portal.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <button
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-[#8892b0]/20 bg-white/5 px-4 py-4 font-medium text-[#ccd6f6] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#64ffda]/40 hover:bg-white/10 hover:shadow-[0_5px_15px_rgba(100,255,218,0.15)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        {loading ? "Signing in..." : "Continue with Google"}
      </button>

      <p className="mt-8 text-center text-xs text-[#8892b0]/60">
        By signing in, you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex h-screen w-full flex-col-reverse overflow-hidden bg-[#020c1b] lg:flex-row">
      {/* Globe: bottom on mobile, left side on desktop */}
      <div className="h-[40vh] w-full shrink-0 bg-black lg:h-full lg:w-auto lg:flex-1">
        <DynamicLoginGlobe />
      </div>

      {/* Login form: top on mobile, right panel on desktop */}
      <div className="flex min-h-0 flex-1 flex-col justify-center bg-[#0a192f] lg:w-[480px] lg:flex-none lg:shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
        <Suspense
          fallback={
            <div className="flex items-center justify-center text-[#8892b0]">
              Loading...
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
