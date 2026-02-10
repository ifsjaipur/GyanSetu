import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "__session";
const MAX_AGE = parseInt(process.env.SESSION_COOKIE_MAX_AGE || "432000") * 1000; // ms

/**
 * POST /api/auth/session
 * Exchange a Firebase ID token for a session cookie.
 */
export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();
    if (!idToken) {
      return NextResponse.json(
        { error: "Missing idToken" },
        { status: 400 }
      );
    }

    const adminAuth = getAdminAuth();
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: MAX_AGE,
    });

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, sessionCookie, {
      maxAge: MAX_AGE / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Session creation failed:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 401 }
    );
  }
}

/**
 * DELETE /api/auth/session
 * Clear the session cookie (logout).
 */
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  return NextResponse.json({ status: "ok" });
}
