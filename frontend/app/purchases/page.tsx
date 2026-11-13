
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";

type Purchase = {
  id: string;
  job_name: string;
  item_description: string;
  reason: string;
  amount: number;
  status: string;
  recommendation: string;
  source: "chat" | "form";
  after_the_fact: boolean;
  created_at: string;
};

export default function PurchasesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState(true);
  const [error, setError] = useState("");

  // Protect this page just like our chat and purchase form.
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/login");
    } else if (user.must_change_password) {
      router.replace("/change-password");
    }
  }, [authLoading, user, router]);

  // Load purchases after authentication succeeds.
  useEffect(() => {
    if (authLoading || !user || user.must_change_password) return;

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
            err instanceof Error ? err.message : "Failed to load purchases."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingPurchases(false);
        }
      }
    }

    loadPurchases();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  if (authLoading || !user || user.must_change_password) {
    return <p className="p-8">Checking authentication...</p>;
  }

  return (
    <main className="w-full max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold">Purchase History</h1>

      <p className="mt-2 text-gray-400">
        Welcome, {user.name}.
      </p>

      {loadingPurchases && (
        <p className="mt-8">Loading purchases...</p>
      )}

      {error && (
        <p role="alert" className="mt-8 text-red-400">
          {error}
        </p>
      )}

      {!loadingPurchases && !error && purchases.length === 0 && (
        <p className="mt-8 text-gray-400">
          No purchases found.
        </p>
      )}

      {!loadingPurchases && !error && purchases.length > 0 && (
        <div className="mt-8 space-y-4">
            {purchases.map((purchase) => (
              <div
                key={purchase.id}
                onClick={() => {
                  if (user.role === "admin" || user.role === "manager") {
                    router.push(`/purchases/${purchase.id}`);
                  }
                }}
                className={`rounded-lg border border-gray-700 p-5 ${
                  user.role === "admin" || user.role === "manager"
                    ? "cursor-pointer transition-colors hover:bg-gray-900"
                    : ""
                }`}
              >
              <div className="flex justify-between gap-4">
                <h2 className="font-semibold">
                  {purchase.item_description}
                </h2>

                <span>
                  ${Number(purchase.amount).toFixed(2)}
                </span>
              </div>

              <p className="mt-2 text-sm text-gray-400">
                Job: {purchase.job_name}
              </p>

              <p className="mt-1 text-sm text-gray-400">
                Status: {purchase.status}
              </p>

              <p className="mt-1 text-sm text-gray-400">
                Source: {purchase.source}
              </p>

              <p className="mt-1 text-sm text-gray-400">
                {new Date(purchase.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
