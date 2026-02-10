export enum UserRole {
  SUPER_ADMIN = "super_admin",
  INSTITUTION_ADMIN = "institution_admin",
  INSTRUCTOR = "instructor",
  STUDENT = "student",
}

/** Ordered from highest to lowest privilege */
export const ROLE_HIERARCHY: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.INSTITUTION_ADMIN,
  UserRole.INSTRUCTOR,
  UserRole.STUDENT,
];

/** Check if `userRole` has at least the privilege level of `requiredRole` */
export function hasMinimumRole(
  userRole: UserRole,
  requiredRole: UserRole
): boolean {
  return (
    ROLE_HIERARCHY.indexOf(userRole) <= ROLE_HIERARCHY.indexOf(requiredRole)
  );
}
