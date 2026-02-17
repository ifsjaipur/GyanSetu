import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCallerContext } from "@/lib/auth/get-caller-context";

const VALID_ROLES = ["super_admin", "institution_admin", "instructor", "student"];

/**
 * GET /api/users
 * List users in the institution.
 * Query params:
 *   ?role=instructor          — single role filter
 *   ?roles=super_admin,instructor — comma-separated multi-role filter
 *   ?institutionId=xxx        — super_admin only
 *
 * Permissions:
 *   - super_admin / institution_admin: full access
 *   - instructor: can only query ?role=instructor (to see other instructors)
 */
export async function GET(request: NextRequest) {
  try {
    const caller = await getCallerContext(request.cookies.get("__session")?.value);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const roleParam = searchParams.get("role");
    const rolesParam = searchParams.get("roles");

    const db = getAdminDb();

    // Instructors can only fetch the instructor list
    if (caller.role === "instructor") {
      if (roleParam !== "instructor") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (!["super_admin", "institution_admin"].includes(caller.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const institutionId =
      caller.role === "super_admin"
        ? searchParams.get("institutionId") || caller.institutionId
        : caller.institutionId;

    // Build role filter
    let rolesList: string[] = [];
    if (rolesParam) {
      rolesList = rolesParam.split(",").filter((r) => VALID_ROLES.includes(r));
    } else if (roleParam && VALID_ROLES.includes(roleParam)) {
      rolesList = [roleParam];
    }

    const isMentorQuery = rolesList.length > 0 &&
      rolesList.every((r) => r !== "student");

    let snap: FirebaseFirestore.QuerySnapshot;

    if (isMentorQuery && caller.role === "super_admin") {
      // Super admin: show all mentors across all institutions
      let query: FirebaseFirestore.Query = db.collection("users");
      query = query.where("role", "in", rolesList);
      snap = await query.limit(200).get();
    } else if (caller.role === "super_admin" && roleParam === "student") {
      // Super admin searching for students: show all students across all institutions
      let query: FirebaseFirestore.Query = db.collection("users");
      query = query.where("role", "==", "student");
      snap = await query.limit(200).get();
    } else {
      let query: FirebaseFirestore.Query = db
        .collection("users")
        .where("institutionId", "==", institutionId);
      if (rolesList.length > 0) {
        query = query.where("role", "in", rolesList);
      }
      snap = await query.limit(200).get();
    }

    // Enrich with memberships for mentor queries
    const enrichWithMemberships = isMentorQuery;
    const users = await Promise.all(
      snap.docs.map(async (doc) => {
        const data = { id: doc.id, ...doc.data() };
        if (enrichWithMemberships) {
          const membershipsSnap = await db
            .collection("users")
            .doc(doc.id)
            .collection("memberships")
            .where("status", "==", "approved")
            .get();
          const institutions = membershipsSnap.docs.map((m) => m.data().institutionId);
          return { ...data, institutions };
        }
        return data;
      })
    );

    return NextResponse.json({ users });
  } catch (err) {
    console.error("GET /api/users error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
