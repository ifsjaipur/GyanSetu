import { NextResponse } from "next/server";
import { UserRole, hasMinimumRole } from "@shared/enums/roles";
import type { AuthenticatedRequest } from "./withAuth";

type AuthenticatedHandler = (
  request: AuthenticatedRequest,
  context?: { params: Record<string, string> }
) => Promise<NextResponse>;

/**
 * Wraps an authenticated handler with role-based access control.
 * Must be used after `withAuth`.
 *
 * @param requiredRole - The minimum role required to access this endpoint
 * @param handler - The route handler to protect
 */
export function withRole(
  requiredRole: UserRole,
  handler: AuthenticatedHandler
): AuthenticatedHandler {
  return async (request, context?) => {
    const userRole = request.auth?.role as UserRole | undefined;

    if (!userRole || !hasMinimumRole(userRole, requiredRole)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    return handler(request, context);
  };
}
