import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

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
    const sessionCookie = request.cookies.get("__session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, false);
    const { searchParams } = request.nextUrl;
    const roleParam = searchParams.get("role");
    const rolesParam = searchParams.get("roles");

    const db = getAdminDb();

    // Read caller's role from Firestore (token claims may be stale)
    const callerDoc = await db.collection("users").doc(decoded.uid).get();
    const callerData = callerDoc.data();
    const callerRole = callerData?.role || decoded.role || "student";

    // Instructors can only fetch the instructor list
    if (callerRole === "instructor") {
      if (roleParam !== "instructor") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (!["super_admin", "institution_admin"].includes(callerRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let institutionId =
      callerRole === "super_admin"
        ? searchParams.get("institutionId") || callerData?.institutionId || decoded.institutionId
        : callerData?.institutionId || decoded.institutionId;

    if (!institutionId) {
      institutionId = process.env.NEXT_PUBLIC_DEFAULT_INSTITUTION_ID || "ifs";
    }

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

    if (isMentorQuery && callerRole === "super_admin") {
      // Super admin: show all mentors across all institutions
      let query: FirebaseFirestore.Query = db.collection("users");
      query = query.where("role", "in", rolesList);
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
