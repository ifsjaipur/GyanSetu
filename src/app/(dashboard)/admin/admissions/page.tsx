"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

/* ---------- Types ---------- */

interface AdmissionItem {
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string | null;
  displayName: string;
  email: string;
  role: string;
  city: string | null;
  state: string | null;
  joinMethod: string;
  status: string;
  institutionId: string;
  institutionName: string | null;
  requestedAt: { _seconds: number; _nanoseconds: number } | string | null;
  reviewedAt: { _seconds: number; _nanoseconds: number } | string | null;
  reviewNote: string | null;
  transferredTo: string | null;
}

interface InstitutionOption {
  id: string;
  name: string;
}

/* ---------- Constants ---------- */

const STATUS_TABS = ["all", "pending", "approved", "rejected", "transferred"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700",
  approved: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
  transferred: "bg-blue-50 text-blue-700",
};

const JOIN_METHOD_LABELS: Record<string, string> = {
  browse: "Browse",
  invite_code: "Invite Code",
  email_domain: "Email Domain",
  admin_added: "Admin Added",
};

/* ---------- Helpers ---------- */

function formatTimestamp(val: unknown): string {
  if (!val) return "\u2014";
  if (typeof val === "object" && val !== null && "_seconds" in val) {
    return new Date(
      (val as { _seconds: number })._seconds * 1000
    ).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  const d = new Date(val as string | number);
  return isNaN(d.getTime()) ? "\u2014" : d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isToday(val: unknown): boolean {
  if (!val) return false;
  let d: Date;
  if (typeof val === "object" && val !== null && "_seconds" in val) {
    d = new Date((val as { _seconds: number })._seconds * 1000);
  } else {
    d = new Date(val as string | number);
  }
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

/* ---------- Component ---------- */

export default function AdminAdmissionsPage() {
  const { userData, loading: authLoading } = useAuth();
  const router = useRouter();

  const [admissions, setAdmissions] = useState<AdmissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<StatusTab>("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Search & pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Reject modal state
  const [rejectModal, setRejectModal] = useState<{
    open: boolean;
    userId: string;
    note: string;
  }>({ open: false, userId: "", note: "" });

  // Transfer modal state
  const [transferModal, setTransferModal] = useState<{
    open: boolean;
    userId: string;
    note: string;
    institutionId: string;
  }>({ open: false, userId: "", note: "", institutionId: "" });

  const [institutions, setInstitutions] = useState<InstitutionOption[]>([]);
  const [institutionsLoaded, setInstitutionsLoaded] = useState(false);

  // Sync members state
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  /* ---------- Auth guard ---------- */

  useEffect(() => {
    if (authLoading) return;
    if (
      !userData ||
      (userData.role !== "institution_admin" && userData.role !== "super_admin")
    ) {
      router.replace("/dashboard");
    }
  }, [authLoading, userData, router]);

  /* ---------- Fetch admissions (all statuses, filter client-side) ---------- */

  const fetchAdmissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/memberships", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setAdmissions(data.memberships || []);
      }
    } catch (err) {
      console.error("Failed to fetch admissions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (
      !authLoading &&
      userData &&
      (userData.role === "institution_admin" || userData.role === "super_admin")
    ) {
      fetchAdmissions();
    }
  }, [authLoading, userData, fetchAdmissions]);

  /* ---------- Fetch institutions (for transfer modal) ---------- */

  const fetchInstitutions = useCallback(async () => {
    if (institutionsLoaded) return;
    try {
      const res = await fetch("/api/institutions", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setInstitutions(
          (data.institutions || []).map((inst: { id: string; name: string }) => ({
            id: inst.id,
            name: inst.name,
          }))
        );
        setInstitutionsLoaded(true);
      }
    } catch (err) {
      console.error("Failed to fetch institutions:", err);
    }
  }, [institutionsLoaded]);

  /* ---------- Actions ---------- */

  async function handleApprove(userId: string) {
    setActionLoading(userId);
    try {
      const admission = admissions.find((a) => a.userId === userId);
      const res = await fetch(`/api/memberships/${userId}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          action: "approve",
          institutionId: admission?.institutionId,
        }),
      });
      if (res.ok) {
        setAdmissions((prev) =>
          prev.map((a) =>
            a.userId === userId ? { ...a, status: "approved" } : a
          )
        );
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`Failed to approve: ${data.error || res.statusText}`);
        fetchAdmissions();
      }
    } catch (err) {
      console.error("Failed to approve:", err);
      alert("Failed to approve. Please try again.");
      fetchAdmissions();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject() {
    const { userId, note } = rejectModal;
    setActionLoading(userId);
    setRejectModal({ open: false, userId: "", note: "" });
    try {
      const admission = admissions.find((a) => a.userId === userId);
      const res = await fetch(`/api/memberships/${userId}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          action: "reject",
          note,
          institutionId: admission?.institutionId,
        }),
      });
      if (res.ok) {
        setAdmissions((prev) =>
          prev.map((a) =>
            a.userId === userId
              ? { ...a, status: "rejected", reviewNote: note }
              : a
          )
        );
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`Failed to reject: ${data.error || res.statusText}`);
        fetchAdmissions();
      }
    } catch (err) {
      console.error("Failed to reject:", err);
      alert("Failed to reject. Please try again.");
      fetchAdmissions();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleTransfer() {
    const { userId, note, institutionId: targetInstitutionId } = transferModal;
    if (!targetInstitutionId) return;
    setActionLoading(userId);
    setTransferModal({ open: false, userId: "", note: "", institutionId: "" });
    try {
      const admission = admissions.find((a) => a.userId === userId);
      const res = await fetch(`/api/memberships/${userId}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          action: "transfer",
          transferToInstitutionId: targetInstitutionId,
          institutionId: admission?.institutionId,
          note,
        }),
      });
      if (res.ok) {
        setAdmissions((prev) =>
          prev.map((a) =>
            a.userId === userId
              ? {
                  ...a,
                  status: "transferred",
                  transferredTo: targetInstitutionId,
                  reviewNote: note,
                }
              : a
          )
        );
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`Failed to transfer: ${data.error || res.statusText}`);
        fetchAdmissions();
      }
    } catch (err) {
      console.error("Failed to transfer:", err);
      alert("Failed to transfer. Please try again.");
      fetchAdmissions();
    } finally {
      setActionLoading(null);
    }
  }

  /* ---------- Promote role ---------- */

  async function handlePromote(userId: string, newRole: string) {
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/users/${userId}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        setAdmissions((prev) =>
          prev.map((a) =>
            a.userId === userId ? { ...a, role: newRole } : a
          )
        );
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`Failed to update role: ${data.error || res.statusText}`);
      }
    } catch (err) {
      console.error("Failed to update role:", err);
      alert("Failed to update role. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  const isSuperAdmin = userData?.role === "super_admin";

  /* ---------- Sync missing memberships ---------- */

  async function handleSyncMembers() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/admin/backfill-memberships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.backfilled > 0) {
          setSyncMessage(`${data.backfilled} missing membership(s) synced`);
          fetchAdmissions();
        } else {
          setSyncMessage("All members are already synced");
        }
      } else {
        const data = await res.json();
        setSyncMessage(`Error: ${data.error}`);
      }
    } catch {
      setSyncMessage("Failed to sync members");
    } finally {
      setSyncing(false);
    }
  }

  /* ---------- Computed stats ---------- */

  const pendingCount = admissions.filter((a) => a.status === "pending").length;
  const approvedToday = admissions.filter(
    (a) => a.status === "approved" && isToday(a.reviewedAt)
  ).length;
  const totalApproved = admissions.filter(
    (a) => a.status === "approved"
  ).length;

  // Reset to page 1 when search or tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab]);

  /* ---------- Search + Pagination ---------- */

  const filteredAdmissions = admissions.filter((a) => {
    // Filter by active tab
    if (activeTab !== "all" && a.status !== activeTab) return false;

    // Filter by search query
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = (a.userName || a.displayName || "").toLowerCase();
    const email = (a.userEmail || a.email || "").toLowerCase();
    const phone = (a.userPhone || "").toLowerCase();
    return name.includes(q) || email.includes(q) || phone.includes(q);
  });

  const totalPages = Math.max(1, Math.ceil(filteredAdmissions.length / perPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedAdmissions = filteredAdmissions.slice(
    (safePage - 1) * perPage,
    safePage * perPage
  );

  /* ---------- Guard render ---------- */

  if (
    authLoading ||
    !userData ||
    (userData.role !== "institution_admin" && userData.role !== "super_admin")
  ) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-[var(--muted-foreground)]">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admissions</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Review and manage institution membership requests
          </p>
        </div>
        <button
          onClick={handleSyncMembers}
          disabled={syncing}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] disabled:opacity-50"
        >
          {syncing ? "Syncing..." : "Sync Members"}
        </button>
      </div>

      {syncMessage && (
        <div
          className={`mt-3 rounded-lg p-3 text-sm ${
            syncMessage.startsWith("Error")
              ? "bg-red-50 text-red-600"
              : "bg-green-50 text-green-600"
          }`}
        >
          {syncMessage}
        </div>
      )}

      {/* Stats Bar */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="text-xs font-medium text-[var(--muted-foreground)]">
            Pending Requests
          </div>
          <div className="mt-1 text-2xl font-bold text-yellow-600">
            {pendingCount}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="text-xs font-medium text-[var(--muted-foreground)]">
            Approved Today
          </div>
          <div className="mt-1 text-2xl font-bold text-green-600">
            {approvedToday}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="text-xs font-medium text-[var(--muted-foreground)]">
            Total Members
          </div>
          <div className="mt-1 text-2xl font-bold">{totalApproved}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? "bg-[var(--brand-primary)] text-white"
                : "text-[var(--muted-foreground)] hover:bg-[var(--border)]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Search + Per-page controls */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] sm:max-w-xs"
        />
        <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <span>Show</span>
          <select
            value={perPage}
            onChange={(e) => {
              setPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm"
          >
            <option value={10}>10</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>per page</span>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="mt-8 text-[var(--muted-foreground)]">Loading...</div>
      ) : filteredAdmissions.length === 0 ? (
        <div className="mt-8 text-center text-[var(--muted-foreground)]">
          {searchQuery.trim()
            ? "No results matching your search."
            : `No ${activeTab === "all" ? "" : activeTab} admission requests found.`}
        </div>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                  <th className="pb-3 pr-4 font-medium">Student</th>
                  <th className="pb-3 pr-4 font-medium">Institution</th>
                  <th className="pb-3 pr-4 font-medium">Join Method</th>
                  <th className="pb-3 pr-4 font-medium">Requested</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedAdmissions.map((admission) => (
                  <tr
                    key={admission.userId}
                    className="border-b border-[var(--border)] transition-colors hover:bg-[var(--card)]"
                  >
                    {/* Student Name + Email + Phone */}
                    <td className="py-3 pr-4">
                      <div className="font-medium">
                        {admission.userName || admission.displayName || admission.userId}
                      </div>
                      <div className="text-xs text-[var(--muted-foreground)]">
                        {admission.userEmail || admission.email}
                      </div>
                      {admission.userPhone && (
                        <div className="text-xs text-[var(--muted-foreground)]">
                          {admission.userPhone}
                        </div>
                      )}
                    </td>

                    {/* Institution */}
                    <td className="py-3 pr-4 text-xs text-[var(--muted-foreground)]">
                      {admission.institutionName || admission.institutionId || "\u2014"}
                    </td>

                    {/* Join Method */}
                    <td className="py-3 pr-4">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        {JOIN_METHOD_LABELS[admission.joinMethod] ||
                          admission.joinMethod}
                      </span>
                    </td>

                    {/* Date Requested */}
                    <td className="py-3 pr-4 text-xs text-[var(--muted-foreground)]">
                      {formatTimestamp(admission.requestedAt)}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_COLORS[admission.status] || ""
                        }`}
                      >
                        {admission.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3">
                      {admission.status === "pending" ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(admission.userId)}
                            disabled={actionLoading === admission.userId}
                            className="rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                          >
                            {actionLoading === admission.userId
                              ? "..."
                              : "Approve"}
                          </button>
                          <button
                            onClick={() =>
                              setRejectModal({
                                open: true,
                                userId: admission.userId,
                                note: "",
                              })
                            }
                            disabled={actionLoading === admission.userId}
                            className="rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => {
                              fetchInstitutions();
                              setTransferModal({
                                open: true,
                                userId: admission.userId,
                                note: "",
                                institutionId: "",
                              });
                            }}
                            disabled={actionLoading === admission.userId}
                            className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                          >
                            Transfer
                          </button>
                        </div>
                      ) : admission.status === "approved" ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[var(--muted-foreground)]">
                            {admission.role === "student" ? "Student" : admission.role.replace(/_/g, " ")}
                          </span>
                          {admission.role === "student" && (
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value) handlePromote(admission.userId, e.target.value);
                              }}
                              disabled={actionLoading === admission.userId}
                              className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs disabled:opacity-50"
                            >
                              <option value="">Promote...</option>
                              <option value="instructor">Instructor</option>
                              <option value="institution_admin">Institution Admin</option>
                              {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                            </select>
                          )}
                          {admission.role !== "student" && (
                            <select
                              value={admission.role}
                              onChange={(e) => handlePromote(admission.userId, e.target.value)}
                              disabled={actionLoading === admission.userId}
                              className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs disabled:opacity-50"
                            >
                              <option value="student">Student</option>
                              <option value="instructor">Instructor</option>
                              <option value="institution_admin">Institution Admin</option>
                              {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                            </select>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {admission.reviewNote
                            ? `Note: ${admission.reviewNote}`
                            : "\u2014"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="text-[var(--muted-foreground)]">
              Showing {(safePage - 1) * perPage + 1}–{Math.min(safePage * perPage, filteredAdmissions.length)} of {filteredAdmissions.length}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="rounded-lg border border-[var(--border)] px-3 py-1 text-sm font-medium transition-colors hover:bg-[var(--border)] disabled:opacity-50"
              >
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                .reduce<(number | "...")[]>((acc, p, i, arr) => {
                  if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === "..." ? (
                    <span key={`dot-${i}`} className="px-2 py-1 text-[var(--muted-foreground)]">...</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`rounded-lg border px-3 py-1 text-sm font-medium transition-colors ${
                        p === safePage
                          ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                          : "border-[var(--border)] hover:bg-[var(--border)]"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="rounded-lg border border-[var(--border)] px-3 py-1 text-sm font-medium transition-colors hover:bg-[var(--border)] disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {/* Reject Modal */}
      {rejectModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-lg">
            <h2 className="text-lg font-semibold">Reject Admission</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Optionally add a note explaining the rejection reason.
            </p>
            <textarea
              value={rejectModal.note}
              onChange={(e) =>
                setRejectModal((prev) => ({ ...prev, note: e.target.value }))
              }
              placeholder="Rejection reason (optional)"
              rows={3}
              className="mt-4 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() =>
                  setRejectModal({ open: false, userId: "", note: "" })
                }
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--border)]"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {transferModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-lg">
            <h2 className="text-lg font-semibold">Transfer Student</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Select the institution to transfer this student to.
            </p>

            <label className="mt-4 block text-sm font-medium">
              Institution
            </label>
            <select
              value={transferModal.institutionId}
              onChange={(e) =>
                setTransferModal((prev) => ({
                  ...prev,
                  institutionId: e.target.value,
                }))
              }
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            >
              <option value="">Select an institution...</option>
              {institutions.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}
                </option>
              ))}
            </select>

            <label className="mt-4 block text-sm font-medium">
              Note (optional)
            </label>
            <textarea
              value={transferModal.note}
              onChange={(e) =>
                setTransferModal((prev) => ({ ...prev, note: e.target.value }))
              }
              placeholder="Transfer reason"
              rows={3}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            />

            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() =>
                  setTransferModal({
                    open: false,
                    userId: "",
                    note: "",
                    institutionId: "",
                  })
                }
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--border)]"
              >
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                disabled={!transferModal.institutionId}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
