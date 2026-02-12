"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Exam {
  id: string;
  title: string;
  description: string;
  type: "google_forms" | "manual" | "classroom_assignment";
  status: "draft" | "published" | "closed";
  passingScore: number;
  maxAttempts: number;
  timeLimitMinutes: number | null;
  isRequired: boolean;
  order: number;
  googleFormsConfig: {
    formId: string;
    formUrl: string;
    responseUrl: string;
    spreadsheetId: string | null;
    autoGraded: boolean;
  } | null;
  manualConfig: {
    instructions: string;
    rubric: string;
    maxScore: number;
    submissionType: "file_upload" | "text" | "link";
  } | null;
}

interface Attempt {
  id: string;
  examId: string;
  userId: string;
  attemptNumber: number;
  status: "in_progress" | "submitted" | "graded" | "failed";
  score: number | null;
  maxScore: number;
  percentageScore: number | null;
  passed: boolean | null;
  submissionText: string | null;
  submissionUrl: string | null;
  feedback: string | null;
  startedAt: { _seconds: number };
  submittedAt: { _seconds: number } | null;
}

const TYPE_LABELS: Record<string, string> = {
  google_forms: "Google Forms",
  manual: "Manual Evaluation",
  classroom_assignment: "Classroom",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-700",
  published: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-600",
};

export default function InstructorExamsPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Create form state
  const [newExam, setNewExam] = useState({
    title: "",
    description: "",
    type: "manual" as Exam["type"],
    passingScore: 50,
    maxAttempts: 3,
    timeLimitMinutes: null as number | null,
    isRequired: true,
    order: 0,
    formUrl: "",
    formId: "",
    instructions: "",
    rubric: "",
    maxScore: 100,
    submissionType: "text" as "file_upload" | "text" | "link",
  });

  // Grading state
  const [gradingExamId, setGradingExamId] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [gradingAttempt, setGradingAttempt] = useState<Attempt | null>(null);
  const [gradeScore, setGradeScore] = useState(0);
  const [gradeFeedback, setGradeFeedback] = useState("");

  useEffect(() => {
    fetchExams();
  }, [courseId]);

  async function fetchExams() {
    try {
      const res = await fetch(`/api/exams?courseId=${courseId}`);
      if (res.ok) {
        const data = await res.json();
        setExams(data.exams || []);
      }
    } catch (err) {
      console.error("Failed to fetch exams:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    setSaving(true);
    setMessage(null);

    const payload: Record<string, unknown> = {
      courseId,
      title: newExam.title,
      description: newExam.description,
      type: newExam.type,
      passingScore: newExam.passingScore,
      maxAttempts: newExam.maxAttempts,
      timeLimitMinutes: newExam.timeLimitMinutes,
      isRequired: newExam.isRequired,
      order: newExam.order,
    };

    if (newExam.type === "google_forms") {
      payload.googleFormsConfig = {
        formId: newExam.formId,
        formUrl: newExam.formUrl,
        responseUrl: "",
        spreadsheetId: null,
        autoGraded: true,
      };
    } else if (newExam.type === "manual") {
      payload.manualConfig = {
        instructions: newExam.instructions,
        rubric: newExam.rubric,
        maxScore: newExam.maxScore,
        submissionType: newExam.submissionType,
      };
    }

    try {
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setMessage("Exam created");
        setShowCreate(false);
        setNewExam({
          title: "",
          description: "",
          type: "manual",
          passingScore: 50,
          maxAttempts: 3,
          timeLimitMinutes: null,
          isRequired: true,
          order: exams.length,
          formUrl: "",
          formId: "",
          instructions: "",
          rubric: "",
          maxScore: 100,
          submissionType: "text",
        });
        fetchExams();
      } else {
        const data = await res.json();
        setMessage(`Error: ${data.error}`);
      }
    } catch {
      setMessage("Failed to create exam");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(examId: string, newStatus: string) {
    try {
      const res = await fetch(`/api/exams/${examId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchExams();
        setMessage(`Exam ${newStatus}`);
      }
    } catch {
      setMessage("Failed to update status");
    }
  }

  async function handleDelete(examId: string) {
    if (!confirm("Delete this exam? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/exams/${examId}`, { method: "DELETE" });
      if (res.ok) {
        fetchExams();
        setMessage("Exam deleted");
      }
    } catch {
      setMessage("Failed to delete exam");
    }
  }

  async function loadAttempts(examId: string) {
    setGradingExamId(examId);
    try {
      const res = await fetch(`/api/exams/${examId}/attempts`);
      if (res.ok) {
        const data = await res.json();
        setAttempts(data.attempts || []);
      }
    } catch {
      setMessage("Failed to load attempts");
    }
  }

  async function handleGrade() {
    if (!gradingAttempt) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/exams/${gradingAttempt.examId}/attempts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: gradingAttempt.id,
          score: gradeScore,
          feedback: gradeFeedback,
        }),
      });

      if (res.ok) {
        setMessage("Graded successfully");
        setGradingAttempt(null);
        loadAttempts(gradingAttempt.examId);
      } else {
        const data = await res.json();
        setMessage(`Error: ${data.error}`);
      }
    } catch {
      setMessage("Failed to grade");
    } finally {
      setSaving(false);
    }
  }

  async function handleSyncForms(examId: string) {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/exams/${examId}/sync-forms`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        setMessage(data.message);
        if (gradingExamId === examId) {
          loadAttempts(examId);
        }
      } else {
        const data = await res.json();
        setMessage(`Error: ${data.error}`);
      }
    } catch {
      setMessage("Failed to sync forms");
    } finally {
      setSaving(false);
    }
  }

  function formatDate(ts: { _seconds: number } | null) {
    if (!ts) return "—";
    return new Date(ts._seconds * 1000).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  if (loading) return <div className="text-[var(--muted-foreground)]">Loading...</div>;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Exams</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: "var(--brand-primary)" }}
        >
          {showCreate ? "Cancel" : "+ New Exam"}
        </button>
      </div>

      {message && (
        <div
          className={`mt-3 rounded-lg p-3 text-sm ${
            message.startsWith("Error")
              ? "bg-red-50 text-red-600"
              : "bg-green-50 text-green-600"
          }`}
        >
          {message}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="mt-4 rounded-lg border border-[var(--border)] p-4 space-y-4">
          <h2 className="font-semibold">Create Exam</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">Title</label>
              <input
                type="text"
                value={newExam.title}
                onChange={(e) => setNewExam({ ...newExam, title: e.target.value })}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                placeholder="Midterm Exam"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">Description</label>
              <textarea
                rows={2}
                value={newExam.description}
                onChange={(e) => setNewExam({ ...newExam, description: e.target.value })}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Type</label>
              <select
                value={newExam.type}
                onChange={(e) => setNewExam({ ...newExam, type: e.target.value as Exam["type"] })}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                <option value="manual">Manual Evaluation</option>
                <option value="google_forms">Google Forms</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium">Passing Score (%)</label>
              <input
                type="number"
                value={newExam.passingScore}
                onChange={(e) => setNewExam({ ...newExam, passingScore: parseInt(e.target.value) || 0 })}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Max Attempts</label>
              <input
                type="number"
                value={newExam.maxAttempts}
                onChange={(e) => setNewExam({ ...newExam, maxAttempts: parseInt(e.target.value) || 1 })}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Time Limit (minutes)</label>
              <input
                type="number"
                value={newExam.timeLimitMinutes || ""}
                onChange={(e) =>
                  setNewExam({ ...newExam, timeLimitMinutes: e.target.value ? parseInt(e.target.value) : null })
                }
                placeholder="No limit"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newExam.isRequired}
                  onChange={(e) => setNewExam({ ...newExam, isRequired: e.target.checked })}
                  className="h-4 w-4"
                />
                <span className="text-sm">Required for course completion</span>
              </label>
            </div>
          </div>

          {/* Google Forms config */}
          {newExam.type === "google_forms" && (
            <div className="border-t border-[var(--border)] pt-4 space-y-3">
              <h3 className="text-sm font-medium">Google Forms Configuration</h3>
              <div>
                <label className="block text-sm">Form URL</label>
                <input
                  type="text"
                  value={newExam.formUrl}
                  onChange={(e) => setNewExam({ ...newExam, formUrl: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  placeholder="https://docs.google.com/forms/d/e/..."
                />
              </div>
              <div>
                <label className="block text-sm">Form ID</label>
                <input
                  type="text"
                  value={newExam.formId}
                  onChange={(e) => setNewExam({ ...newExam, formId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  placeholder="1FAIpQLSe..."
                />
              </div>
            </div>
          )}

          {/* Manual config */}
          {newExam.type === "manual" && (
            <div className="border-t border-[var(--border)] pt-4 space-y-3">
              <h3 className="text-sm font-medium">Manual Evaluation Configuration</h3>
              <div>
                <label className="block text-sm">Instructions for Students</label>
                <textarea
                  rows={3}
                  value={newExam.instructions}
                  onChange={(e) => setNewExam({ ...newExam, instructions: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  placeholder="Describe what students need to submit..."
                />
              </div>
              <div>
                <label className="block text-sm">Grading Rubric</label>
                <textarea
                  rows={3}
                  value={newExam.rubric}
                  onChange={(e) => setNewExam({ ...newExam, rubric: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  placeholder="Describe how the submission will be graded..."
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm">Max Score</label>
                  <input
                    type="number"
                    value={newExam.maxScore}
                    onChange={(e) => setNewExam({ ...newExam, maxScore: parseInt(e.target.value) || 100 })}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm">Submission Type</label>
                  <select
                    value={newExam.submissionType}
                    onChange={(e) =>
                      setNewExam({ ...newExam, submissionType: e.target.value as "text" | "link" | "file_upload" })
                    }
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  >
                    <option value="text">Text Submission</option>
                    <option value="link">Link/URL</option>
                    <option value="file_upload">File Upload</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={saving || !newExam.title}
            className="rounded-lg px-6 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            {saving ? "Creating..." : "Create Exam"}
          </button>
        </div>
      )}

      {/* Exams list */}
      <div className="mt-6 space-y-3">
        {exams.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            No exams created yet for this course.
          </p>
        ) : (
          exams.map((exam) => (
            <div key={exam.id} className="rounded-lg border border-[var(--border)] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{exam.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[exam.status]}`}>
                      {exam.status}
                    </span>
                    {exam.isRequired && (
                      <span className="text-xs text-orange-600 bg-orange-50 rounded-full px-2 py-0.5">Required</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {TYPE_LABELS[exam.type]} &middot; Pass: {exam.passingScore}% &middot; Max attempts: {exam.maxAttempts}
                    {exam.timeLimitMinutes ? ` · ${exam.timeLimitMinutes} min` : ""}
                  </p>
                  {exam.description && (
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">{exam.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {exam.status === "draft" && (
                    <button
                      onClick={() => handleStatusChange(exam.id, "published")}
                      className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
                    >
                      Publish
                    </button>
                  )}
                  {exam.status === "published" && (
                    <button
                      onClick={() => handleStatusChange(exam.id, "closed")}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-[var(--muted)]"
                    >
                      Close
                    </button>
                  )}
                  {exam.status === "closed" && (
                    <button
                      onClick={() => handleStatusChange(exam.id, "published")}
                      className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
                    >
                      Reopen
                    </button>
                  )}
                  {exam.type === "google_forms" && (
                    <button
                      onClick={() => handleSyncForms(exam.id)}
                      disabled={saving}
                      className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                    >
                      Sync Forms
                    </button>
                  )}
                  <button
                    onClick={() => loadAttempts(exam.id)}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--muted)]"
                  >
                    View Submissions
                  </button>
                  <button
                    onClick={() => handleDelete(exam.id)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Submissions/Grading Panel */}
      {gradingExamId && (
        <div className="mt-6 rounded-lg border border-[var(--border)] p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">
              Submissions ({attempts.length})
            </h2>
            <button
              onClick={() => {
                setGradingExamId(null);
                setAttempts([]);
                setGradingAttempt(null);
              }}
              className="text-sm text-[var(--muted-foreground)] hover:underline"
            >
              Close
            </button>
          </div>

          {attempts.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">No submissions yet.</p>
          ) : (
            <div className="space-y-3">
              {attempts.map((attempt) => (
                <div
                  key={attempt.id}
                  className="rounded-lg border border-[var(--border)] p-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">
                        Attempt #{attempt.attemptNumber}
                      </span>
                      <span className="ml-2 text-xs text-[var(--muted-foreground)]">
                        User: {attempt.userId.slice(0, 8)}...
                      </span>
                      <span
                        className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                          attempt.status === "graded"
                            ? attempt.passed
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                            : attempt.status === "submitted"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {attempt.status}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      {formatDate(attempt.startedAt)}
                    </div>
                  </div>

                  {attempt.submissionText && (
                    <div className="mt-2 rounded bg-[var(--muted)] p-2 text-sm whitespace-pre-wrap">
                      {attempt.submissionText}
                    </div>
                  )}

                  {attempt.submissionUrl && (
                    <div className="mt-2 text-sm">
                      <a
                        href={attempt.submissionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--brand-primary)] hover:underline"
                      >
                        View Submission
                      </a>
                    </div>
                  )}

                  {attempt.status === "graded" && (
                    <div className="mt-2 text-sm">
                      Score: <strong>{attempt.score}/{attempt.maxScore}</strong> ({attempt.percentageScore}%)
                      {attempt.passed !== null && (
                        <span className={`ml-2 ${attempt.passed ? "text-green-600" : "text-red-600"}`}>
                          {attempt.passed ? "Passed" : "Failed"}
                        </span>
                      )}
                      {attempt.feedback && (
                        <p className="mt-1 text-[var(--muted-foreground)]">Feedback: {attempt.feedback}</p>
                      )}
                    </div>
                  )}

                  {attempt.status === "submitted" && (
                    <div className="mt-3">
                      {gradingAttempt?.id === attempt.id ? (
                        <div className="space-y-3 rounded-lg bg-[var(--muted)] p-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label className="block text-sm font-medium">Score</label>
                              <input
                                type="number"
                                value={gradeScore}
                                onChange={(e) => setGradeScore(parseInt(e.target.value) || 0)}
                                max={attempt.maxScore}
                                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                              />
                              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                                out of {attempt.maxScore}
                              </p>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium">Feedback</label>
                            <textarea
                              rows={2}
                              value={gradeFeedback}
                              onChange={(e) => setGradeFeedback(e.target.value)}
                              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                              placeholder="Optional feedback for the student..."
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={handleGrade}
                              disabled={saving}
                              className="rounded-lg px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                              style={{ backgroundColor: "var(--brand-primary)" }}
                            >
                              {saving ? "Grading..." : "Submit Grade"}
                            </button>
                            <button
                              onClick={() => setGradingAttempt(null)}
                              className="rounded-lg border border-[var(--border)] px-4 py-1.5 text-sm hover:bg-[var(--muted)]"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setGradingAttempt(attempt);
                            setGradeScore(0);
                            setGradeFeedback("");
                          }}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-white"
                          style={{ backgroundColor: "var(--brand-primary)" }}
                        >
                          Grade
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
