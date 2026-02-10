"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

export default function EnrollPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleEnroll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Step 1: Create order
      const orderRes = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });

      if (!orderRes.ok) {
        const data = await orderRes.json();
        setError(data.error || "Failed to create order");
        setLoading(false);
        return;
      }

      const orderData = await orderRes.json();

      // Free course — already enrolled
      if (orderData.free) {
        setSuccess(true);
        setTimeout(() => router.push(`/courses/${courseId}/learn`), 1500);
        return;
      }

      // Step 2: Open Razorpay checkout
      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        order_id: orderData.orderId,
        name: "GyanSetu",
        description: "Course Enrollment",
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          // Step 3: Verify payment
          try {
            const verifyRes = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                paymentId: orderData.paymentId,
              }),
            });

            if (verifyRes.ok) {
              setSuccess(true);
              setTimeout(() => router.push(`/courses/${courseId}/learn`), 1500);
            } else {
              setError("Payment verification failed. Contact support.");
            }
          } catch {
            setError("Payment verification failed. Contact support.");
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },
        theme: {
          color: "#1E40AF",
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("Enrollment error:", err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }, [courseId, router]);

  if (success) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="text-4xl">✓</div>
          <h2 className="mt-4 text-xl font-bold text-[var(--success)]">
            Enrolled Successfully!
          </h2>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Redirecting to your course...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
        <h1 className="text-xl font-bold">Complete Enrollment</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          Click below to proceed with payment and enrollment.
        </p>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          onClick={handleEnroll}
          disabled={loading}
          className="mt-6 w-full rounded-lg px-6 py-3 text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--brand-primary)" }}
        >
          {loading ? "Processing..." : "Proceed to Payment"}
        </button>

        <button
          onClick={() => router.back()}
          className="mt-3 text-sm text-[var(--muted-foreground)] hover:underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
