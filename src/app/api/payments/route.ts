import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCallerContext } from "@/lib/auth/get-caller-context";

/**
 * GET /api/payments
 * List payments. Admin only.
 */
export async function GET(request: NextRequest) {
  try {
    const caller = await getCallerContext(request.cookies.get("__session")?.value);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const allowedRoles = ["super_admin", "institution_admin"];
    if (!allowedRoles.includes(caller.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getAdminDb();
    const institutionId =
      caller.role === "super_admin"
        ? request.nextUrl.searchParams.get("institutionId") || caller.institutionId
        : caller.institutionId;

    const snap = await db
      .collection("payments")
      .where("institutionId", "==", institutionId)
      .limit(100)
      .get();

    const payments = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Enrich with user names and course titles
    if (payments.length > 0) {
      const userIds = [...new Set(
        payments.map((p) => (p as unknown as { userId: string }).userId).filter(Boolean)
      )];
      const courseIds = [...new Set(
        payments.map((p) => (p as unknown as { courseId: string }).courseId).filter(Boolean)
      )];

      const [userDocs, courseDocs] = await Promise.all([
        userIds.length > 0
          ? db.getAll(...userIds.map((id) => db.collection("users").doc(id)))
          : Promise.resolve([]),
        courseIds.length > 0
          ? db.getAll(...courseIds.map((id) => db.collection("courses").doc(id)))
          : Promise.resolve([]),
      ]);

      const userMap = new Map<string, string>();
      userDocs.forEach((doc) => {
        if (doc.exists) {
          const d = doc.data()!;
          userMap.set(doc.id, d.displayName || d.email || doc.id);
        }
      });

      const courseMap = new Map<string, string>();
      courseDocs.forEach((doc) => {
        if (doc.exists) {
          courseMap.set(doc.id, doc.data()!.title || doc.id);
        }
      });

      const enriched = payments.map((p) => {
        const userId = (p as unknown as { userId: string }).userId;
        const courseId = (p as unknown as { courseId: string }).courseId;
        return {
          ...p,
          userName: userId ? userMap.get(userId) || userId : undefined,
          courseTitle: courseId ? courseMap.get(courseId) || courseId : undefined,
        };
      });

      return NextResponse.json({ payments: enriched });
    }

    return NextResponse.json({ payments });
  } catch (err) {
    console.error("GET /api/payments error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
