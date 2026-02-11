"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface AttendanceRecord {
  id: string;
  userId: string;
  sessionDate: string;
  status: string;
  notes: string | null;
  userName?: string;
  userEmail?: string;
}

interface EnrolledStudent {
  userId: string;
  displayName: string;
  email: string;
}

interface Session {
  id: string;
  sessionDate: string;
  topic: string;
}

export default function AttendancePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [markings, setMarkings] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch sessions
        const sessRes = await fetch(`/api/courses/${courseId}/sessions`);
        if (sessRes.ok) {
          const sessData = await sessRes.json();
          setSessions(sessData.sessions || []);
        }

        // Fetch enrolled students
        const enrollRes = await fetch(`/api/enrollments?courseId=${courseId}`);
        if (enrollRes.ok) {
          const enrollData = await enrollRes.json();
          const enrollments = enrollData.enrollments || [];

          // Fetch user details for each enrollment
          const studentsList: EnrolledStudent[] = [];
          for (const enroll of enrollments) {
            if (enroll.status !== "active") continue;
            try {
              const userRes = await fetch(`/api/users?uid=${enroll.userId}`);
              if (userRes.ok) {
                const userData = await userRes.json();
                const users = userData.users || [];
                const user = users.find((u: { uid: string }) => u.uid === enroll.userId);
                if (user) {
                  studentsList.push({
                    userId: enroll.userId,
                    displayName: user.displayName || user.email,
                    email: user.email,
                  });
                }
              }
            } catch {
              studentsList.push({
                userId: enroll.userId,
                displayName: enroll.userId,
                email: "",
              });
            }
          }
          setStudents(studentsList);
        }
      } catch (err) {
        console.error("Failed to load attendance data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [courseId]);

  // Fetch attendance when date is selected
  useEffect(() => {
    if (!selectedDate) return;

    async function fetchAttendance() {
      try {
        const res = await fetch(`/api/courses/${courseId}/attendance?sessionDate=${selectedDate}`);
        if (res.ok) {
          const data = await res.json();
          const records = data.attendance || [];
          setAttendance(records);

          // Pre-fill markings from existing records
          const m: Record<string, string> = {};
          records.forEach((r: AttendanceRecord) => {
            m[r.userId] = r.status;
          });
          // Default unrecorded students to "absent"
          students.forEach((s) => {
            if (!m[s.userId]) m[s.userId] = "absent";
          });
          setMarkings(m);
        }
      } catch (err) {
        console.error("Failed to fetch attendance:", err);
      }
    }

    fetchAttendance();
  }, [selectedDate, courseId, students]);

  async function saveAttendance() {
    if (!selectedDate) return;
    setSaving(true);
    try {
      const records = Object.entries(markings).map(([userId, status]) => ({
        userId,
        status,
      }));

      const res = await fetch(`/api/courses/${courseId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionDate: selectedDate, records }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Saved ${data.ids?.length || 0} attendance records`);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to save");
      }
    } catch (err) {
      console.error("Failed to save attendance:", err);
    } finally {
      setSaving(false);
    }
  }

  function markAll(status: string) {
    const m: Record<string, string> = {};
    students.forEach((s) => {
      m[s.userId] = status;
    });
    setMarkings(m);
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-[var(--muted-foreground)]">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Attendance</h1>

      {/* Session selector */}
      <div className="mb-6">
        <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
          Select Session
        </label>
        <select
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm w-full max-w-sm"
        >
          <option value="">Choose a session...</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.sessionDate}>
              {s.sessionDate} — {s.topic}
            </option>
          ))}
        </select>
      </div>

      {selectedDate && students.length > 0 && (
        <>
          {/* Quick mark all */}
          <div className="mb-4 flex gap-2">
            <button
              onClick={() => markAll("present")}
              className="rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs text-green-700 hover:bg-green-100"
            >
              Mark All Present
            </button>
            <button
              onClick={() => markAll("absent")}
              className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-700 hover:bg-red-100"
            >
              Mark All Absent
            </button>
          </div>

          {/* Student list */}
          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                  <th className="text-left py-2.5 px-4 font-medium">Student</th>
                  <th className="text-center py-2.5 px-2 font-medium">Present</th>
                  <th className="text-center py-2.5 px-2 font-medium">Absent</th>
                  <th className="text-center py-2.5 px-2 font-medium">Late</th>
                  <th className="text-center py-2.5 px-2 font-medium">Excused</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.userId} className="border-b border-[var(--border)]">
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-sm">{student.displayName}</div>
                      <div className="text-xs text-[var(--muted-foreground)]">{student.email}</div>
                    </td>
                    {(["present", "absent", "late", "excused"] as const).map((status) => (
                      <td key={status} className="text-center py-2.5 px-2">
                        <input
                          type="radio"
                          name={`attendance-${student.userId}`}
                          checked={markings[student.userId] === status}
                          onChange={() =>
                            setMarkings({ ...markings, [student.userId]: status })
                          }
                          className="w-4 h-4"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={saveAttendance}
            disabled={saving}
            className="mt-4 rounded-lg px-6 py-2 text-sm text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            {saving ? "Saving..." : "Save Attendance"}
          </button>
        </>
      )}

      {selectedDate && students.length === 0 && (
        <p className="text-[var(--muted-foreground)]">No enrolled students found for this course.</p>
      )}
    </div>
  );
}
