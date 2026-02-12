import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { createCourseSchema } from "@shared/validators/course.validator";

/**
 * GET /api/courses
 * List courses. Filtered by institution, status, type.
 */
export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("__session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const db = getAdminDb();
    const { searchParams } = request.nextUrl;

    // Treat missing role as student (claims may not have propagated yet for new users)
    const role = decoded.role || "student";

    // Resolve institutionId: from claims, query param, user doc, or default
    let institutionId = role === "super_admin"
      ? searchParams.get("institutionId") || decoded.institutionId
      : decoded.institutionId;

    // Fallback: look up from user doc if claims haven't propagated yet
    if (!institutionId) {
      const userDoc = await db.collection("users").doc(decoded.uid).get();
      if (userDoc.exists) {
        institutionId = userDoc.data()?.institutionId;
      }
    }

    // Last resort: use default institution
    if (!institutionId) {
      institutionId = process.env.NEXT_PUBLIC_DEFAULT_INSTITUTION_ID || "ifs";
    }

    let query = db
      .collection("courses")
      .where("institutionId", "==", institutionId);

    // Students only see published courses
    if (role === "student") {
      query = query.where("status", "==", "published");
    }

    const typeFilter = searchParams.get("type");
    if (typeFilter) {
      query = query.where("type", "==", typeFilter);
    }

    const snap = await query.get();
    const courses = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ courses });
  } catch (err) {
    console.error("GET /api/courses error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/courses
 * Create a new course. Admin or instructor.
 */
export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("__session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const allowedRoles = ["super_admin", "institution_admin", "instructor"];
    if (!allowedRoles.includes(decoded.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createCourseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const db = getAdminDb();
    const institutionId = decoded.institutionId;

    if (!institutionId) {
      return NextResponse.json({ error: "No institution assigned" }, { status: 400 });
    }

    // Check slug uniqueness within institution
    const existing = await db
      .collection("courses")
      .where("institutionId", "==", institutionId)
      .where("slug", "==", data.slug)
      .limit(1)
      .get();

    if (!existing.empty) {
      return NextResponse.json(
        { error: "A course with this slug already exists" },
        { status: 409 }
      );
    }

    const courseRef = db.collection("courses").doc();
    const courseData = {
      ...data,
      id: courseRef.id,
      institutionId,
      shortDescription: data.shortDescription || "",
      thumbnailUrl: data.thumbnailUrl || "",
      bootcampConfig: null,
      instructorLedConfig: null,
      selfPacedConfig: null,
      classroomCourseId: null,
      classroomInviteLink: null,
      prerequisites: data.prerequisites || [],
      moduleOrder: [],
      status: "draft" as const,
      isVisible: false,
      enrollmentCount: 0,
      createdBy: decoded.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await courseRef.set(courseData);

    return NextResponse.json(courseData, { status: 201 });
  } catch (err) {
    console.error("Create course failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
