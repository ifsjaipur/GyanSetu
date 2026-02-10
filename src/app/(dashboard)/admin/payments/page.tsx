"use client";

import { useEffect, useState } from "react";

interface PaymentItem {
  id: string;
  userId: string;
  courseId: string;
  amount: number;
  currency: string;
  status: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  receiptNumber: string;
  paidAt: string | null;
  // Populated
  userName?: string;
  courseTitle?: string;
}

const STATUS_COLORS: Record<string, string> = {
  created: "bg-gray-100 text-gray-600",
  authorized: "bg-yellow-100 text-yellow-700",
  captured: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  refunded: "bg-orange-100 text-orange-700",
};

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPayments() {
      try {
        const res = await fetch("/api/payments");
        if (res.ok) {
          const data = await res.json();
          setPayments(data.payments);
        }
      } catch (err) {
        console.error("Failed to fetch payments:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchPayments();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">Payments</h1>

      <div className="mt-2 flex gap-4 text-sm text-[var(--muted-foreground)]">
        <span>{payments.length} total</span>
        <span>
          {payments.filter((p) => p.status === "captured").length} captured
        </span>
        <span>
          ₹
          {(
            payments
              .filter((p) => p.status === "captured")
              .reduce((sum, p) => sum + p.amount, 0) / 100
          ).toLocaleString("en-IN")}{" "}
          revenue
        </span>
      </div>

      {loading ? (
        <div className="mt-8 text-[var(--muted-foreground)]">Loading...</div>
      ) : payments.length === 0 ? (
        <div className="mt-8 text-center text-[var(--muted-foreground)]">
          No payments found.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                <th className="pb-3 pr-4 font-medium">Receipt</th>
                <th className="pb-3 pr-4 font-medium">Student</th>
                <th className="pb-3 pr-4 font-medium">Course</th>
                <th className="pb-3 pr-4 font-medium">Amount</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr
                  key={payment.id}
                  className="border-b border-[var(--border)]"
                >
                  <td className="py-3 pr-4 font-mono text-xs">
                    {payment.receiptNumber}
                  </td>
                  <td className="py-3 pr-4">
                    {payment.userName || payment.userId}
                  </td>
                  <td className="py-3 pr-4">
                    {payment.courseTitle || payment.courseId}
                  </td>
                  <td className="py-3 pr-4 font-medium">
                    ₹{(payment.amount / 100).toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_COLORS[payment.status] || ""
                      }`}
                    >
                      {payment.status}
                    </span>
                  </td>
                  <td className="py-3 text-xs text-[var(--muted-foreground)]">
                    {payment.paidAt
                      ? new Date(payment.paidAt).toLocaleDateString()
                      : "—"}
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
