import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCallerContext } from "@/lib/auth/get-caller-context";

/**
 * GET /api/certificates
 * List certificates. Students see their own; admins/instructors see all in institution.
 */
export async function GET(request: NextRequest) {
  try {
    const caller = await getCallerContext(request.cookies.get("__session")?.value);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const db = getAdminDb();

    let query = db
      .collection("certificates")
      .where("institutionId", "==", caller.institutionId);

    if (caller.role === "student") {
      query = query.where("userId", "==", caller.uid);
    }

    const snap = await query.orderBy("createdAt", "desc").limit(100).get();
    const certificates = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    const response = NextResponse.json({ certificates });
    response.headers.set("Cache-Control", "private, max-age=60, stale-while-revalidate=300");
    return response;
  } catch (err) {
    console.error("GET certificates error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
