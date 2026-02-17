import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { reviewMembershipSchema } from "@shared/validators/membership.validator";
import { writeAuditLog } from "@/lib/audit-log";

/**
 * PUT /api/memberships/:membershipId/review
 * Review a membership request: approve, reject, or transfer.
 * The membershipId path param is the userId — the membership doc lives at
 * users/{userId}/memberships/{institutionId}.
 *
 * Body: { userId, action, note?, transferToInstitutionId? }
 * Only institution_admin or super_admin.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  try {
    const { membershipId } = await params;
    const sessionCookie = request.cookies.get("__session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const allowedRoles = ["super_admin", "institution_admin"];
    if (!allowedRoles.includes(decoded.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getAdminDb();

    const body = await request.json();
    const parsed = reviewMembershipSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { userId, action, note, transferToInstitutionId } = parsed.data;

    // Determine which institution's membership to review
    // For institution_admin: use their own institutionId from decoded claims
    // For super_admin: use institutionId from query param or body
    let institutionId: string;
    if (decoded.role === "super_admin") {
      const { searchParams } = request.nextUrl;
      institutionId =
        searchParams.get("institutionId") ||
        (body.institutionId as string) ||
        "";
      if (!institutionId) {
        return NextResponse.json(
          { error: "institutionId is required for super_admin" },
          { status: 400 }
        );
      }
    } else {
      // institution_admin
      institutionId = decoded.institutionId;
      if (!institutionId) {
        return NextResponse.json(
          { error: "No institution assigned" },
          { status: 403 }
        );
      }
    }

    // Fetch the membership document
    const membershipRef = db
      .collection("users")
      .doc(userId)
      .collection("memberships")
      .doc(institutionId);
    const membershipDoc = await membershipRef.get();

    if (!membershipDoc.exists) {
      return NextResponse.json(
        { error: "Membership not found" },
        { status: 404 }
      );
    }

    const membership = membershipDoc.data()!;

    // Verify the admin belongs to the same institution (unless super_admin)
    if (
      decoded.role === "institution_admin" &&
      membership.institutionId !== decoded.institutionId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // --- Action: approve ---
    if (action === "approve") {
      await membershipRef.update({
        status: "approved",
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: decoded.uid,
        reviewNote: note || null,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Update user doc: set institutionId and activeInstitutionId if not already set
      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        const userData = userDoc.data()!;
        const updates: Record<string, unknown> = {
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (!userData.institutionId) {
          updates.institutionId = institutionId;
        }
        if (!userData.activeInstitutionId) {
          updates.activeInstitutionId = institutionId;
        }
        await userRef.update(updates);

        // Update custom claims to include institutionId
        const auth = getAdminAuth();
        const currentClaims = (await auth.getUser(userId)).customClaims || {};
        await auth.setCustomUserClaims(userId, {
          ...currentClaims,
          institutionId: userData.institutionId || institutionId,
        });
      }

      // Auto-enroll in mother institute if this is a child institution
      const instDoc = await db.collection("institutions").doc(institutionId).get();
      const instData = instDoc.exists ? instDoc.data() : null;
      if (instData?.parentInstitutionId) {
        const motherMembershipRef = db
          .collection("users")
          .doc(userId)
          .collection("memberships")
          .doc(instData.parentInstitutionId);
        const motherMembership = await motherMembershipRef.get();
        if (!motherMembership.exists) {
          await motherMembershipRef.set({
            id: instData.parentInstitutionId,
            userId,
            institutionId: instData.parentInstitutionId,
            role: "student",
            status: "approved",
            isExternal: false,
            joinMethod: "auto_parent",
            requestedAt: FieldValue.serverTimestamp(),
            reviewedAt: FieldValue.serverTimestamp(),
            reviewedBy: null,
            reviewNote: `Auto-enrolled via child institution ${institutionId}`,
            transferredTo: null,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
          console.log(`Auto-enrolled ${userId} in mother institution ${instData.parentInstitutionId}`);
        }
      }

      writeAuditLog(
        {
          institutionId,
          userId: decoded.uid,
          userEmail: decoded.email || "",
          userRole: decoded.role,
          action: "membership.approve",
          resource: "membership",
          resourceId: `${userId}/${institutionId}`,
          details: { targetUserId: userId, note: note || null },
          severity: "info",
        },
        request
      );

      return NextResponse.json({
        message: "Membership approved",
        userId,
        institutionId,
        status: "approved",
      });
    }

    // --- Action: reject ---
    if (action === "reject") {
      await membershipRef.update({
        status: "rejected",
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: decoded.uid,
        reviewNote: note || null,
        updatedAt: FieldValue.serverTimestamp(),
      });

      writeAuditLog(
        {
          institutionId,
          userId: decoded.uid,
          userEmail: decoded.email || "",
          userRole: decoded.role,
          action: "membership.reject",
          resource: "membership",
          resourceId: `${userId}/${institutionId}`,
          details: { targetUserId: userId, note: note || null },
          severity: "info",
        },
        request
      );

      return NextResponse.json({
        message: "Membership rejected",
        userId,
        institutionId,
        status: "rejected",
      });
    }

    // --- Action: transfer ---
    if (action === "transfer") {
      if (!transferToInstitutionId) {
        return NextResponse.json(
          { error: "transferToInstitutionId is required for transfer action" },
          { status: 400 }
        );
      }

      // Verify target institution exists and is active
      const targetInstDoc = await db
        .collection("institutions")
        .doc(transferToInstitutionId)
        .get();
      if (!targetInstDoc.exists) {
        return NextResponse.json(
          { error: "Target institution not found" },
          { status: 404 }
        );
      }
      if (!targetInstDoc.data()!.isActive) {
        return NextResponse.json(
          { error: "Target institution is not active" },
          { status: 400 }
        );
      }

      // Update current membership to "transferred"
      await membershipRef.update({
        status: "transferred",
        transferredTo: transferToInstitutionId,
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: decoded.uid,
        reviewNote: note || null,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Create a new pending membership at the target institution
      const newMembershipData = {
        id: transferToInstitutionId,
        userId,
        institutionId: transferToInstitutionId,
        role: "student",
        status: "pending",
        isExternal: membership.isExternal ?? true,
        joinMethod: "admin_added" as const,
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
        .doc(userId)
        .collection("memberships")
        .doc(transferToInstitutionId)
        .set(newMembershipData);

      writeAuditLog(
        {
          institutionId,
          userId: decoded.uid,
          userEmail: decoded.email || "",
          userRole: decoded.role,
          action: "membership.transfer",
          resource: "membership",
          resourceId: `${userId}/${institutionId}`,
          details: {
            targetUserId: userId,
            fromInstitutionId: institutionId,
            toInstitutionId: transferToInstitutionId,
            note: note || null,
          },
          severity: "warning",
        },
        request
      );

      return NextResponse.json({
        message: "Membership transferred",
        userId,
        fromInstitutionId: institutionId,
        toInstitutionId: transferToInstitutionId,
        status: "transferred",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("PUT /api/memberships/[membershipId]/review error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
