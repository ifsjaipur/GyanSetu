import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { requestMembershipSchema } from "@shared/validators/membership.validator";
import { getCallerContext } from "@/lib/auth/get-caller-context";

/**
 * GET /api/memberships
 * List memberships.
 * - Students see their own memberships (subcollection).
 * - Institution admins see memberships for their institution (collection group).
 * - Super admins see all memberships (collection group), filterable by institutionId.
 * Query params: ?status=pending|approved|rejected|transferred, ?institutionId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const caller = await getCallerContext(request.cookies.get("__session")?.value);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const db = getAdminDb();
    const { searchParams } = request.nextUrl;

    const statusFilter = searchParams.get("status");
    const institutionIdFilter = searchParams.get("institutionId");

    // --- Student view: own memberships subcollection ---
    if (caller.role === "student") {
      const snap = await db
        .collection("users")
        .doc(caller.uid)
        .collection("memberships")
        .get();

      const memberships = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Enrich with institution name
      const instIds = [
        ...new Set(
          memberships
            .map((m) => (m as unknown as { institutionId: string }).institutionId)
            .filter(Boolean)
        ),
      ];
      const instMap = new Map<string, string>();
      if (instIds.length > 0) {
        const instRefs = instIds.map((id) => db.collection("institutions").doc(id));
        const instDocs = await db.getAll(...instRefs);
        instDocs.forEach((doc) => {
          if (doc.exists) {
            instMap.set(doc.id, doc.data()!.name || doc.id);
          }
        });
      }

      const enriched = memberships.map((m) => ({
        ...m,
        institutionName:
          instMap.get((m as unknown as { institutionId: string }).institutionId) || null,
      }));

      const response = NextResponse.json({ memberships: enriched });
      response.headers.set(
        "Cache-Control",
        "private, no-cache, no-store, must-revalidate"
      );
      return response;
    }

    // --- Admin views: collection group query ---
    let query = db.collectionGroup("memberships") as FirebaseFirestore.Query;

    if (caller.role === "institution_admin") {
      // Institution admins see only their institution's memberships
      const adminInstitutionId = caller.institutionId;
      if (!adminInstitutionId) {
        return NextResponse.json(
          { error: "No institution assigned" },
          { status: 403 }
        );
      }
      query = query.where("institutionId", "==", adminInstitutionId);
    } else if (caller.role === "super_admin") {
      // Super admins can optionally filter by institutionId
      if (institutionIdFilter) {
        query = query.where("institutionId", "==", institutionIdFilter);
      }
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Optional status filter
    if (statusFilter) {
      query = query.where("status", "==", statusFilter);
    }

    const snap = await query.limit(200).get();
    const memberships = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Enrich with institution name
    const instIds = [
      ...new Set(
        memberships
          .map((m) => (m as unknown as { institutionId: string }).institutionId)
          .filter(Boolean)
      ),
    ];
    const instMap = new Map<string, string>();
    if (instIds.length > 0) {
      const instRefs = instIds.map((id) => db.collection("institutions").doc(id));
      const instDocs = await db.getAll(...instRefs);
      instDocs.forEach((doc) => {
        if (doc.exists) {
          instMap.set(doc.id, doc.data()!.name || doc.id);
        }
      });
    }

    // Enrich with user info for admin views
    const userIds = [
      ...new Set(
        memberships
          .map((m) => (m as unknown as { userId: string }).userId)
          .filter(Boolean)
      ),
    ];
    const userMap = new Map<string, { displayName: string; email: string; phone: string | null; role: string }>();
    if (userIds.length > 0) {
      const userRefs = userIds.map((id) => db.collection("users").doc(id));
      const userDocs = await db.getAll(...userRefs);
      userDocs.forEach((doc) => {
        if (doc.exists) {
          const d = doc.data()!;
          userMap.set(doc.id, {
            displayName: d.displayName || d.email || doc.id,
            email: d.email || "",
            phone: d.phone || null,
            role: d.role || "student",
          });
        }
      });
    }

    const enriched = memberships
      .map((m) => {
        const userId = (m as unknown as { userId: string }).userId;
        const institutionId = (m as unknown as { institutionId: string }).institutionId;
        const user = userId ? userMap.get(userId) : undefined;

        // Skip memberships for deleted users
        if (!user && userId) {
          console.warn(`Skipping membership for deleted user: ${userId}`);
          return null;
        }

        return {
          ...m,
          // Use the user doc's role as source of truth (membership doc may be stale)
          role: user?.role || (m as unknown as { role?: string }).role || "student",
          institutionName: instMap.get(institutionId) || null,
          ...(user
            ? { userName: user.displayName, userEmail: user.email, userPhone: user.phone }
            : {}),
        };
      })
      .filter((m) => m !== null);

    const response = NextResponse.json({ memberships: enriched });
    response.headers.set(
      "Cache-Control",
      "private, max-age=10, stale-while-revalidate=30"
    );
    return response;
  } catch (err) {
    console.error("GET /api/memberships error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/memberships
 * Request membership in an institution.
 * Body: { institutionId, joinMethod, inviteCode? }
 */
export async function POST(request: NextRequest) {
  try {
    const caller = await getCallerContext(request.cookies.get("__session")?.value);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const db = getAdminDb();

    const body = await request.json();
    const parsed = requestMembershipSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { institutionId, joinMethod, inviteCode } = parsed.data;

    // Verify institution exists and is active
    const instDoc = await db.collection("institutions").doc(institutionId).get();
    if (!instDoc.exists) {
      return NextResponse.json(
        { error: "Institution not found" },
        { status: 404 }
      );
    }
    const instData = instDoc.data()!;
    if (!instData.isActive) {
      return NextResponse.json(
        { error: "Institution is not active" },
        { status: 400 }
      );
    }

    // Validate invite code if joinMethod is "invite_code"
    if (joinMethod === "invite_code") {
      if (!inviteCode) {
        return NextResponse.json(
          { error: "Invite code is required" },
          { status: 400 }
        );
      }
      if (instData.inviteCode !== inviteCode) {
        return NextResponse.json(
          { error: "Invalid invite code" },
          { status: 400 }
        );
      }
    }

    // Check for existing pending or approved membership (prevent duplicates)
    const existingDoc = await db
      .collection("users")
      .doc(caller.uid)
      .collection("memberships")
      .doc(institutionId)
      .get();

    if (existingDoc.exists) {
      const existingData = existingDoc.data()!;
      if (existingData.status === "pending") {
        return NextResponse.json(
          { error: "You already have a pending membership request for this institution" },
          { status: 409 }
        );
      }
      if (existingData.status === "approved") {
        return NextResponse.json(
          { error: "You are already a member of this institution" },
          { status: 409 }
        );
      }
    }

    // Create membership document
    const membershipData = {
      id: institutionId,
      userId: caller.uid,
      institutionId,
      role: "student",
      status: "pending",
      isExternal: true,
      joinMethod,
      requestedAt: FieldValue.serverTimestamp(),
      reviewedAt: null,
      reviewedBy: null,
      reviewNote: null,
      transferredTo: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await db
      .collection("users")
      .doc(caller.uid)
      .collection("memberships")
      .doc(institutionId)
      .set(membershipData);

    return NextResponse.json(membershipData, { status: 201 });
  } catch (err) {
    console.error("POST /api/memberships error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
