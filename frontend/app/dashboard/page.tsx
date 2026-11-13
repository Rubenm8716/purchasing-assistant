
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";

import Link from "next/link";

type Purchase = {
  id: string;
  job_name: string;
  item_description: string;
  amount: number;
  status: string;
  after_the_fact: boolean;
  has_receipt: boolean;
  has_item_photo: boolean;
  missing_receipt: boolean;
  missing_item_photo: boolean;
  needs_review: boolean;
};

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const canView =
    user?.role === "admin" || user?.role === "manager";

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/login");
    } else if (user.must_change_password) {
      router.replace("/change-password");
    } else if (!canView) {
      router.replace("/purchases");
    }
  }, [authLoading, user, canView, router]);

  useEffect(() => {
    if (authLoading || !user || !canView ||
        user.must_change_password) {
      return;
    }

    let cancelled = false;

    async function loadPurchases() {
      try {
        const response = await fetch(
          "http://localhost:8000/purchases",
          { credentials: "include" }
        );

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        const data: Purchase[] = await response.json();

        if (!cancelled) {
          setPurchases(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load purchases."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPurchases();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, canView]);

  if (authLoading || !user ||
      user.must_change_password || !canView) {
    return <p className="p-8">Checking access...</p>;
  }

  const purchased = purchases.filter(
    (p) => p.status === "purchased"
  );

  const totalSpent = purchased.reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );

  const needsReview = purchases.filter(
    (p) => p.needs_review
  );

  const missingEvidence = purchased.filter(
    (p) => p.missing_receipt || p.missing_item_photo
  );

  const stats = [
    { label: "Total Purchases", value: purchases.length },
    { label: "Recorded Spending", value: `$${totalSpent.toFixed(2)}` },
    { label: "Needs Review", value: needsReview.length },
    { label: "Missing Evidence", value: missingEvidence.length },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-semibold">
        Management Dashboard
      </h1>

      <p className="mt-2 text-gray-400">
        Company purchasing overview
      </p>

      {loading && (
        <p className="mt-8">Loading dashboard...</p>
      )}

      {error && (
        <p role="alert" className="mt-8 text-red-400">
          {error}
        </p>
      )}

      {!loading && !error && (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-gray-800 bg-zinc-900 p-5"
              >
                <p className="text-sm text-gray-400">
                  {stat.label}
                </p>
                <p className="mt-3 text-2xl font-semibold">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          <h2 className="mt-10 text-xl font-semibold">
            Purchases Requiring Review
          </h2>

          {needsReview.length === 0 ? (
            <p className="mt-4 text-gray-400">
              No purchases currently require review.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-gray-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-900 text-gray-400">
                  <tr>
                    <th className="p-4">Job</th>
                    <th className="p-4">Item</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Review Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {needsReview.map((purchase) => {
                    const reasons = [
                      purchase.after_the_fact && "After the fact",
                      purchase.missing_receipt && "Missing receipt",
                      purchase.missing_item_photo && "Missing photo",
                    ].filter(Boolean).join(", ");

                    return (
                        <tr
                        key={purchase.id}
                        onClick={() => router.push(`/purchases/${purchase.id}`)}
                        className="border-t border-gray-800 hover:bg-zinc-900 transition-colors cursor-pointer"
                        >

                        <td className="p-4">{purchase.job_name}</td>

                        <td className="p-4">
                            {purchase.item_description}
                        </td>

                        <td className="p-4">
                          ${Number(purchase.amount).toFixed(2)}
                        </td>
                        <td className="p-4 text-amber-400">
                          {reasons}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
