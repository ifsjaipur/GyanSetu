import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import type { DecodedIdToken } from "firebase-admin/auth";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "__session";

export interface AuthenticatedRequest extends NextRequest {
  auth: DecodedIdToken;
}

type RouteHandler = (
  request: AuthenticatedRequest,
  context?: { params: Record<string, string> }
) => Promise<NextResponse>;

/**
 * Wraps an API route handler with Firebase session cookie verification.
 * Attaches the decoded token to `request.auth`.
 */
export function withAuth(handler: RouteHandler): (request: NextRequest, context?: { params: Record<string, string> }) => Promise<NextResponse> {
  return async (request: NextRequest, context?) => {
    const sessionCookie = request.cookies.get(COOKIE_NAME)?.value;

    if (!sessionCookie) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    try {
      const decodedToken = await getAdminAuth().verifySessionCookie(
        sessionCookie,
        true // Check revocation
      );

      // Attach auth info to the request
      (request as AuthenticatedRequest).auth = decodedToken;

      return handler(request as AuthenticatedRequest, context);
    } catch {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      );
    }
  };
}
