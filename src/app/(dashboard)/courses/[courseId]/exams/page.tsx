"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface Exam {
  id: string;
  title: string;
  description: string;
  type: "google_forms" | "manual" | "classroom_assignment";
  status: string;
  passingScore: number;
  maxAttempts: number;
  timeLimitMinutes: number | null;
  isRequired: boolean;
  order: number;
  googleFormsConfig: {
    formId: string;
    formUrl: string;
  } | null;
  manualConfig: {
    instructions: string;
    maxScore: number;
    submissionType: "file_upload" | "text" | "link";
  } | null;
}

interface Attempt {
  id: string;
  examId: string;
  attemptNumber: number;
  status: "in_progress" | "submitted" | "graded" | "failed";
  score: number | null;
  maxScore: number;
  percentageScore: number | null;
  passed: boolean | null;
  feedback: string | null;
  submissionText: string | null;
  submissionUrl: string | null;
  startedAt: { _seconds: number };
  submittedAt: { _seconds: number } | null;
  gradedAt: { _seconds: number } | null;
}

const TYPE_LABELS: Record<string, string> = {
  google_forms: "Google Forms",
  manual: "Manual Submission",
  classroom_assignment: "Classroom",
};

export default function StudentExamsPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [activeAttempt, setActiveAttempt] = useState<Attempt | null>(null);
  const [submissionText, setSubmissionText] = useState("");
  const [submissionUrl, setSubmissionUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchExams();
  }, [courseId]);

  async function fetchExams() {
    try {
      const res = await fetch(`/api/exams?courseId=${courseId}`);
      if (res.ok) {
        const data = await res.json();
        setExams(data.exams || []);
        setAttempts(data.attempts || []);
      }
    } catch (err) {
      console.error("Failed to fetch exams:", err);
    } finally {
      setLoading(false);
    }
  }

  function getExamAttempts(examId: string) {
    return attempts.filter((a) => a.examId === examId);
  }

  function getBestAttempt(examId: string): Attempt | undefined {
    const examAttempts = getExamAttempts(examId).filter((a) => a.status === "graded");
    if (examAttempts.length === 0) return undefined;
    return examAttempts.reduce((best, curr) =>
      (curr.percentageScore || 0) > (best.percentageScore || 0) ? curr : best
    );
  }

  async function startExam(exam: Exam) {
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/exams/${exam.id}/attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveExam(exam);
        setActiveAttempt(data.attempt);
        setSubmissionText("");
        setSubmissionUrl("");
      } else {
        const data = await res.json();
        setMessage(`Error: ${data.error}`);
      }
    } catch {
      setMessage("Failed to start exam");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAttempt() {
    if (!activeAttempt || !activeExam) return;
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/exams/${activeExam.id}/attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          attemptId: activeAttempt.id,
          submissionText: submissionText || undefined,
          submissionUrl: submissionUrl || undefined,
        }),
      });

      if (res.ok) {
        setMessage("Submitted successfully! Your instructor will review your submission.");
        setActiveExam(null);
        setActiveAttempt(null);
        fetchExams();
      } else {
        const data = await res.json();
        setMessage(`Error: ${data.error}`);
      }
    } catch {
      setMessage("Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  function formatDate(ts: { _seconds: number } | null | undefined) {
    if (!ts) return "—";
    return new Date(ts._seconds * 1000).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  if (loading) return <div className="text-[var(--muted-foreground)]">Loading...</div>;

  // Active exam submission view
  if (activeExam && activeAttempt) {
    return (
      <div className="max-w-3xl">
        <button
          onClick={() => {
            setActiveExam(null);
            setActiveAttempt(null);
          }}
          className="mb-4 text-sm text-[var(--muted-foreground)] hover:underline"
        >
          &larr; Back to exams
        </button>

        <h1 className="text-xl font-bold">{activeExam.title}</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Attempt #{activeAttempt.attemptNumber} of {activeExam.maxAttempts}
          {activeExam.timeLimitMinutes && ` · ${activeExam.timeLimitMinutes} min time limit`}
        </p>

        {activeExam.type === "google_forms" && activeExam.googleFormsConfig && (
          <div className="mt-6">
            <p className="text-sm mb-3">
              Complete the Google Form below, then click Submit when done.
            </p>
            <iframe
              src={activeExam.googleFormsConfig.formUrl}
              className="w-full rounded-lg border border-[var(--border)]"
              style={{ height: "600px" }}
              title={activeExam.title}
            />
            <button
              onClick={submitAttempt}
              disabled={submitting}
              className="mt-4 rounded-lg px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              {submitting ? "Submitting..." : "I've completed the form — Submit"}
            </button>
          </div>
        )}

        {activeExam.type === "manual" && activeExam.manualConfig && (
          <div className="mt-6 space-y-4">
            {activeExam.manualConfig.instructions && (
              <div className="rounded-lg bg-[var(--muted)] p-4">
                <h3 className="text-sm font-medium mb-1">Instructions</h3>
                <p className="text-sm whitespace-pre-wrap">{activeExam.manualConfig.instructions}</p>
              </div>
            )}

            {activeExam.manualConfig.submissionType === "text" && (
              <div>
                <label className="block text-sm font-medium">Your Answer</label>
                <textarea
                  rows={8}
                  value={submissionText}
                  onChange={(e) => setSubmissionText(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  placeholder="Type your answer here..."
                />
              </div>
            )}

            {activeExam.manualConfig.submissionType === "link" && (
              <div>
                <label className="block text-sm font-medium">Submission URL</label>
                <input
                  type="url"
                  value={submissionUrl}
                  onChange={(e) => setSubmissionUrl(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  placeholder="https://..."
                />
              </div>
            )}

            {activeExam.manualConfig.submissionType === "file_upload" && (
              <div>
                <label className="block text-sm font-medium">File URL (paste a link to your file)</label>
                <input
                  type="url"
                  value={submissionUrl}
                  onChange={(e) => setSubmissionUrl(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  placeholder="Google Drive or other file link..."
                />
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Upload your file to Google Drive and paste the sharing link here.
                </p>
              </div>
            )}

            <button
              onClick={submitAttempt}
              disabled={submitting || (!submissionText && !submissionUrl)}
              className="rounded-lg px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Exams list view
  return (
    <div className="max-w-3xl">
      <button
        onClick={() => router.push(`/courses/${courseId}/learn`)}
        className="mb-4 text-sm text-[var(--muted-foreground)] hover:underline"
      >
        &larr; Back to course
      </button>

      <h1 className="text-xl font-bold">Exams</h1>

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

      {exams.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted-foreground)]">
          No exams available for this course yet.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {exams.map((exam) => {
            const examAttempts = getExamAttempts(exam.id);
            const best = getBestAttempt(exam.id);
            const hasInProgress = examAttempts.some((a) => a.status === "in_progress");
            const hasPending = examAttempts.some((a) => a.status === "submitted");
            const canAttempt = examAttempts.length < exam.maxAttempts;

            return (
              <div key={exam.id} className="rounded-lg border border-[var(--border)] p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{exam.title}</h3>
                      {exam.isRequired && (
                        <span className="text-xs text-orange-600 bg-orange-50 rounded-full px-2 py-0.5">
                          Required
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      {TYPE_LABELS[exam.type]} &middot; Pass: {exam.passingScore}%
                      {exam.timeLimitMinutes ? ` · ${exam.timeLimitMinutes} min` : ""}
                      &middot; {examAttempts.length}/{exam.maxAttempts} attempts used
                    </p>
                    {exam.description && (
                      <p className="mt-2 text-sm text-[var(--muted-foreground)]">{exam.description}</p>
                    )}
                  </div>

                  <div className="text-right shrink-0 ml-4">
                    {best && (
                      <div className="mb-2">
                        <span
                          className={`text-sm font-medium ${
                            best.passed ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          Best: {best.percentageScore}%
                        </span>
                        <span
                          className={`ml-1 text-xs ${
                            best.passed ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          ({best.passed ? "Passed" : "Failed"})
                        </span>
                      </div>
                    )}

                    {hasInProgress && (
                      <button
                        onClick={() => startExam(exam)}
                        disabled={submitting}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                        style={{ backgroundColor: "var(--brand-primary)" }}
                      >
                        Resume
                      </button>
                    )}

                    {!hasInProgress && canAttempt && !best?.passed && (
                      <button
                        onClick={() => startExam(exam)}
                        disabled={submitting}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                        style={{ backgroundColor: "var(--brand-primary)" }}
                      >
                        {examAttempts.length === 0 ? "Start Exam" : "Retry"}
                      </button>
                    )}

                    {hasPending && (
                      <span className="text-xs text-blue-600 bg-blue-50 rounded-full px-2 py-1">
                        Awaiting review
                      </span>
                    )}
                  </div>
                </div>

                {/* Past attempts */}
                {examAttempts.length > 0 && (
                  <div className="mt-3 border-t border-[var(--border)] pt-3">
                    <h4 className="text-xs font-medium text-[var(--muted-foreground)] mb-2">
                      Your Attempts
                    </h4>
                    <div className="space-y-2">
                      {examAttempts.map((attempt) => (
                        <div
                          key={attempt.id}
                          className="flex items-center justify-between text-sm rounded bg-[var(--muted)] px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <span>#{attempt.attemptNumber}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                attempt.status === "graded"
                                  ? attempt.passed
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-100 text-red-700"
                                  : attempt.status === "submitted"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-yellow-100 text-yellow-700"
                              }`}
                            >
                              {attempt.status === "in_progress"
                                ? "In Progress"
                                : attempt.status === "submitted"
                                ? "Submitted"
                                : attempt.status === "graded"
                                ? attempt.passed
                                  ? "Passed"
                                  : "Failed"
                                : attempt.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                            {attempt.status === "graded" && (
                              <span>
                                {attempt.score}/{attempt.maxScore} ({attempt.percentageScore}%)
                              </span>
                            )}
                            <span>{formatDate(attempt.submittedAt || attempt.startedAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Show feedback from last graded attempt */}
                    {examAttempts.some((a) => a.status === "graded" && a.feedback) && (
                      <div className="mt-2 rounded-lg bg-blue-50 p-3 text-sm">
                        <span className="font-medium text-blue-700">Instructor Feedback: </span>
                        <span className="text-blue-600">
                          {examAttempts.find((a) => a.status === "graded" && a.feedback)?.feedback}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
