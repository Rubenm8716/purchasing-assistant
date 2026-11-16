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

function EmployeeProfileContent() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const employeeId = params.id;

  const [employee, setEmployee] = useState<Employee | null>(null);
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

        if (!cancelled) {
          setEmployee(data);
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