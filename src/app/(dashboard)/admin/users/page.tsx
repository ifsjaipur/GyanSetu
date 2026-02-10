"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface UserItem {
  uid: string;
  email: string;
  displayName: string;
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
  student: "bg-gray-100 text-gray-600",
};

const ROLE_OPTIONS = ["student", "instructor", "institution_admin", "super_admin"];

export default function AdminUsersPage() {
  const { userData } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch("/api/users");
        if (res.ok) {
          const data = await res.json();
          setUsers(data.users);
        }
      } catch (err) {
        console.error("Failed to fetch users:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, []);

  async function handleRoleChange(uid: string, newRole: string) {
    setUpdatingUid(uid);

    try {
      const res = await fetch(`/api/users/${uid}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.uid === uid ? { ...u, role: newRole } : u))
        );
      }
    } catch (err) {
      console.error("Failed to update role:", err);
    } finally {
      setUpdatingUid(null);
    }
  }

  const isSuperAdmin = userData?.role === "super_admin";
  const availableRoles = isSuperAdmin
    ? ROLE_OPTIONS
    : ROLE_OPTIONS.filter((r) => r !== "super_admin");

  return (
    <div>
      <h1 className="text-2xl font-bold">Users</h1>

      <div className="mt-2 flex gap-4 text-sm text-[var(--muted-foreground)]">
        <span>{users.length} total</span>
        <span>{users.filter((u) => u.isExternal).length} external</span>
        <span>{users.filter((u) => u.role === "instructor").length} instructors</span>
      </div>

      {loading ? (
        <div className="mt-8 text-[var(--muted-foreground)]">Loading...</div>
      ) : users.length === 0 ? (
        <div className="mt-8 text-center text-[var(--muted-foreground)]">
          No users found.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                <th className="pb-3 pr-4 font-medium">User</th>
                <th className="pb-3 pr-4 font-medium">Role</th>
                <th className="pb-3 pr-4 font-medium">Type</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.uid}
                  className="border-b border-[var(--border)]"
                >
                  <td className="py-3 pr-4">
                    <div className="font-medium">{user.displayName}</div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      {user.email}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        ROLE_COLORS[user.role] || ""
                      }`}
                    >
                      {user.role.replace("_", " ")}
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
                    {user.isExternal && !user.profileComplete && (
                      <span className="ml-2 text-xs text-yellow-600">
                        Profile incomplete
                      </span>
                    )}
                  </td>
                  <td className="py-3">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.uid, e.target.value)}
                      disabled={updatingUid === user.uid}
                      className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs disabled:opacity-50"
                    >
                      {availableRoles.map((role) => (
                        <option key={role} value={role}>
                          {role.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
