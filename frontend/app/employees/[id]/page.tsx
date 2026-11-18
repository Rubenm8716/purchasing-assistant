"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";

type Employee = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "employee";
  is_active: boolean;
};

type EmployeePurchase = {
  id: string;
  job_name: string;
  item_description: string;
  amount: number;
  status: "requested" | "purchased" | "cancelled";
  review_status:
    | "not_required"
    | "pending"
    | "in_progress"
    | "resolved";
  after_the_fact: boolean;
  created_at: string;
};

type EmployeeStatistics = {
  total_purchases: number;
  total_spent: number;
  active_investigations: number;
};

function EmployeeProfileContent() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const employeeId = params.id;

  const [employee, setEmployee] = useState<Employee | null>(null);

  const [statistics, setStatistics] = useState<EmployeeStatistics | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [purchases, setPurchases] = useState<EmployeePurchase[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(true);
  const [purchasesError, setPurchasesError] = useState("");

  const canView =
    user?.role === "admin" || user?.role === "manager";


  // EFFECT 1: Check user permissions  
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

  // EFFECT 2: Fetch employee and statistics
  useEffect(() => {
    if (
      authLoading ||
      !user ||
      !canView ||
      user.must_change_password ||
      typeof employeeId !== "string"
    ) {
      return;
    }

    let cancelled = false;

    async function loadEmployee() {
      try {
        const response = await fetch(
          `http://localhost:8000/admin/users/${employeeId}`,
          { credentials: "include" }
        );

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        const data: Employee = await response.json();


        const statsResponse = await fetch(
          `http://localhost:8000/admin/users/${employeeId}/statistics`,
          { credentials: "include" }
        );

        if (!statsResponse.ok) {
          throw new Error(
            `Statistics request failed: ${statsResponse.status}`
          );
        }

        const statsData: EmployeeStatistics = await statsResponse.json();


        if (!cancelled) {
          setEmployee(data);
          setStatistics(statsData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load employee."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadEmployee();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, canView, employeeId]);

   // EFFECT 3: Fetch employee purchases
    useEffect(() => {
      if (
        authLoading ||
        !user ||
        !canView ||
        user.must_change_password ||
        typeof employeeId !== "string"
      ) {
        return;
      }

      let cancelled = false;

      async function loadPurchases() {
        setPurchasesLoading(true);
        setPurchasesError("");

        try {
          const response = await fetch(
            `http://localhost:8000/admin/users/${employeeId}/purchases`,
            { credentials: "include" }
          );

          if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
          }

          const data: EmployeePurchase[] = await response.json();

          if (!cancelled) {
            setPurchases(data);
          }
        } catch (err) {
          if (!cancelled) {
            setPurchasesError(
              err instanceof Error
                ? err.message
                : "Failed to load purchases."
            );
          }
        } finally {
          if (!cancelled) {
            setPurchasesLoading(false);
          }
        }
      }

      void loadPurchases();

      return () => {
        cancelled = true;
      };
    }, [authLoading, user, canView, employeeId]);
    //

  if (authLoading || !user || !canView || user.must_change_password) {
    return <p className="p-8">Checking access...</p>;
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <button
        type="button"
        onClick={() => router.push("/employees")}
        className="mb-6 text-sm text-gray-400 hover:text-white"
      >
        ← Back to Employee Directory
      </button>

      {loading && <p>Loading employee...</p>}

      {error && (
        <p role="alert" className="text-red-400">
          {error}
        </p>
      )}

      {!loading && !error && employee && (
        <>
          <h1 className="text-3xl font-semibold">
            {employee.name}
          </h1>

          <p className="mt-2 text-gray-400">
            {employee.email}
          </p>

          <div className="mt-6 flex gap-3">
            <span className="rounded-md bg-zinc-800 px-3 py-1 text-sm capitalize">
              {employee.role}
            </span>

            <span
              className={`rounded-md px-3 py-1 text-sm ${
                employee.is_active
                  ? "bg-green-500/10 text-green-400"
                  : "bg-red-500/10 text-red-400"
              }`}
            >
              {employee.is_active ? "Active" : "Inactive"}
            </span>
          </div>

          {statistics && (
            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-gray-800 p-6">
                <p className="text-sm text-gray-400">
                  Total Purchases
                </p>
                <p className="mt-3 text-3xl font-semibold">
                  {statistics.total_purchases}
                </p>
              </div>

              <div className="rounded-xl border border-gray-800 p-6">
                <p className="text-sm text-gray-400">
                  Total Spent
                </p>
                <p className="mt-3 text-3xl font-semibold">
                  {statistics.total_spent.toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                  })}
                </p>
              </div>

              <div className="rounded-xl border border-gray-800 p-6">
                <p className="text-sm text-gray-400">
                  Active Investigations
                </p>
                <p className="mt-3 text-3xl font-semibold">
                  {statistics.active_investigations}
                </p>
              </div>
            </div>
          )}
          <div className="mt-8 rounded-xl border border-gray-800 p-6">
            <h2 className="text-xl font-semibold">
              Account Information
            </h2>

            <div className="mt-5 space-y-4">
              <div>
                <p className="text-sm text-gray-400">Full Name</p>
                <p>{employee.name}</p>
              </div>

              <div>
                <p className="text-sm text-gray-400">Email</p>
                <p>{employee.email}</p>
              </div>

              <div>
                <p className="text-sm text-gray-400">Employee ID</p>
                <p className="break-all text-sm">{employee.id}</p>
              </div>
            </div>
          </div>
          <div className="mt-8 rounded-xl border border-gray-800 p-6">
            <h2 className="text-xl font-semibold">
              Purchase History
            </h2>

            {purchasesLoading ? (
              <p className="mt-4 text-gray-400">
                Loading purchases...
              </p>
            ) : purchasesError ? (
              <p role="alert" className="mt-4 text-red-400">
                {purchasesError}
              </p>
            ) : purchases.length === 0 ? (
              <p className="mt-4 text-gray-400">
                No purchases found for this employee.
              </p>
            ) : (
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-800 text-gray-400">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">Job</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Investigation</th>
                    </tr>
                  </thead>

                  <tbody>
                    {purchases.map((purchase) => (
                      <tr
                        key={purchase.id}
                        onClick={() => router.push(`/purchases/${purchase.id}`)}
                        className="cursor-pointer border-b border-gray-800/60 transition-colors hover:bg-zinc-800/40"
                      >
                        <td className="px-4 py-4 text-gray-400">
                          {new Date(purchase.created_at).toLocaleDateString()}
                        </td>

                        <td className="px-4 py-4">
                          {purchase.item_description}
                        </td>

                        <td className="px-4 py-4">
                          {purchase.job_name}
                        </td>

                        <td className="px-4 py-4">
                          {purchase.amount.toLocaleString("en-US", {
                            style: "currency",
                            currency: "USD",
                          })}
                        </td>

                        <td className="px-4 py-4 capitalize">
                          {purchase.status}
                        </td>

                        <td className="px-4 py-4 capitalize">
                          {purchase.review_status.replaceAll("_", " ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function EmployeeProfilePage() {
  return (
    <Suspense fallback={<p className="p-8">Loading employee...</p>}>
      <EmployeeProfileContent />
    </Suspense>
  );
}