"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface UserItem {
  uid: string;
  id?: string;
  email: string;
  displayName: string;
  phone: string | null;
  role: string;
  isExternal: boolean;
  profileComplete: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-purple-100 text-purple-700",
  institution_admin: "bg-blue-100 text-blue-700",
  instructor: "bg-orange-100 text-orange-700",
};

const MENTOR_ROLES = ["instructor", "institution_admin", "super_admin"];

export default function AdminMentorsPage() {
  const { userData } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Add Mentor state
  const [addSearch, setAddSearch] = useState("");
  const [addResults, setAddResults] = useState<UserItem[]>([]);
  const [addLoading, setAddLoading] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);

  const fetchMentors = useCallback(async () => {
    try {
      const res = await fetch(
        "/api/users?roles=super_admin,institution_admin,instructor"
      );
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch (err) {
      console.error("Failed to fetch mentors:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMentors();
  }, [fetchMentors]);

  async function handleRoleChange(uid: string, newRole: string) {
    setUpdatingUid(uid);
    setMessage(null);

    try {
      const res = await fetch(`/api/users/${uid}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        if (newRole === "student") {
          setUsers((prev) => prev.filter((u) => (u.uid || u.id) !== uid));
        } else {
          setUsers((prev) =>
            prev.map((u) => ((u.uid || u.id) === uid ? { ...u, role: newRole } : u))
          );
        }
        setMessage({ text: "Role updated successfully", type: "success" });
      } else {
        const data = await res.json();
        setMessage({ text: data.error || "Failed to update role", type: "error" });
      }
    } catch (err) {
      console.error("Failed to update role:", err);
      setMessage({ text: "Failed to update role", type: "error" });
    } finally {
      setUpdatingUid(null);
    }
  }

  // Search students to add as mentors
  async function handleAddSearch() {
    if (!addSearch.trim()) return;
    setAddLoading(true);
    try {
      const res = await fetch("/api/users?role=student");
      if (res.ok) {
        const data = await res.json();
        const q = addSearch.toLowerCase();
        const results = (data.users as UserItem[]).filter(
          (u) =>
            u.email?.toLowerCase().includes(q) ||
            u.displayName?.toLowerCase().includes(q)
        );
        setAddResults(results);
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setAddLoading(false);
    }
  }

  async function handlePromoteStudent(uid: string, newRole: string) {
    setUpdatingUid(uid);
    setMessage(null);
    try {
      const res = await fetch(`/api/users/${uid}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        setMessage({ text: `User promoted to ${newRole.replace(/_/g, " ")}`, type: "success" });
        // Remove from search results and refresh mentors list
        setAddResults((prev) => prev.filter((u) => (u.uid || u.id) !== uid));
        fetchMentors();
      } else {
        const data = await res.json();
        setMessage({ text: data.error || "Failed to promote", type: "error" });
      }
    } catch (err) {
      console.error("Failed to promote:", err);
      setMessage({ text: "Failed to promote user", type: "error" });
    } finally {
      setUpdatingUid(null);
    }
  }

  const isSuperAdmin = userData?.role === "super_admin";
  const availableRoles = isSuperAdmin
    ? MENTOR_ROLES
    : MENTOR_ROLES.filter((r) => r !== "super_admin");

  // Search filter
  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.displayName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      (u.phone || "").toLowerCase().includes(q)
    );
  });

  // Stats
  const superAdminCount = users.filter((u) => u.role === "super_admin").length;
  const instAdminCount = users.filter(
    (u) => u.role === "institution_admin"
  ).length;
  const instructorCount = users.filter((u) => u.role === "instructor").length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mentors</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Manage administrators and instructors
          </p>
        </div>
        <button
          onClick={() => setShowAddSection(!showAddSection)}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: "var(--brand-primary)" }}
        >
          {showAddSection ? "Close" : "+ Add Mentor"}
        </button>
      </div>

      {message && (
        <div
          className={`mt-4 rounded-lg p-3 text-sm ${
            message.type === "error"
              ? "bg-red-50 text-red-600"
              : "bg-green-50 text-green-600"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Add Mentor Section */}
      {showAddSection && (
        <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <h3 className="font-semibold">Promote a Student</h3>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Search for a student by name or email to promote them to a mentor role.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddSearch()}
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            />
            <button
              onClick={handleAddSearch}
              disabled={addLoading}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              {addLoading ? "..." : "Search"}
            </button>
          </div>
          {addResults.length > 0 && (
            <div className="mt-3 max-h-60 overflow-y-auto">
              {addResults.map((student) => {
                const uid = student.uid || student.id || "";
                return (
                  <div
                    key={uid}
                    className="flex items-center justify-between border-b border-[var(--border)] py-2 last:border-0"
                  >
                    <div>
                      <div className="text-sm font-medium">{student.displayName}</div>
                      <div className="text-xs text-[var(--muted-foreground)]">{student.email}</div>
                    </div>
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) handlePromoteStudent(uid, e.target.value);
                      }}
                      disabled={updatingUid === uid}
                      className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs disabled:opacity-50"
                    >
                      <option value="">Promote to...</option>
                      {availableRoles.map((role) => (
                        <option key={role} value={role}>
                          {role.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          )}
          {addResults.length === 0 && addSearch && !addLoading && (
            <div className="mt-3 text-sm text-[var(--muted-foreground)]">
              No students found matching your search.
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="text-xs font-medium text-[var(--muted-foreground)]">
            Super Admins
          </div>
          <div className="mt-1 text-2xl font-bold text-purple-600">
            {superAdminCount}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="text-xs font-medium text-[var(--muted-foreground)]">
            Institution Admins
          </div>
          <div className="mt-1 text-2xl font-bold text-blue-600">
            {instAdminCount}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="text-xs font-medium text-[var(--muted-foreground)]">
            Instructors
          </div>
          <div className="mt-1 text-2xl font-bold text-orange-600">
            {instructorCount}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mt-4">
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] sm:max-w-xs"
        />
      </div>

      {loading ? (
        <div className="mt-8 text-[var(--muted-foreground)]">Loading...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="mt-8 text-center text-[var(--muted-foreground)]">
          {searchQuery.trim()
            ? "No results matching your search."
            : "No mentors found."}
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                <th className="pb-3 pr-4 font-medium">Name</th>
                <th className="pb-3 pr-4 font-medium">Role</th>
                <th className="pb-3 pr-4 font-medium">Type</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const uid = user.uid || user.id || "";
                return (
                  <tr
                    key={uid}
                    className="border-b border-[var(--border)]"
                  >
                    <td className="py-3 pr-4">
                      <div className="font-medium">{user.displayName}</div>
                      <div className="text-xs text-[var(--muted-foreground)]">
                        {user.email}
                      </div>
                      {user.phone && (
                        <div className="text-xs text-[var(--muted-foreground)]">
                          {user.phone}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          ROLE_COLORS[user.role] || ""
                        }`}
                      >
                        {user.role.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      {user.isExternal ? (
                        <span className="text-xs text-orange-600">External</span>
                      ) : (
                        <span className="text-xs text-green-600">Domain</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`text-xs ${
                          user.isActive ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3">
                      <select
                        value={user.role}
                        onChange={(e) =>
                          handleRoleChange(uid, e.target.value)
                        }
                        disabled={updatingUid === uid}
                        className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs disabled:opacity-50"
                      >
                        {availableRoles.map((role) => (
                          <option key={role} value={role}>
                            {role.replace(/_/g, " ")}
                          </option>
                        ))}
                        <option value="student">student (demote)</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
