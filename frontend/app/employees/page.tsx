
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";

type Employee = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "employee";
  is_active: boolean;
};

type StatusFilter = "active" | "inactive" | "all";

export default function EmployeesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [updatingEmployeeId, setUpdatingEmployeeId] =
  useState<string | null>(null);

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("active");

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
      user.must_change_password
    ) {
      return;
    }

    let cancelled = false;

    async function loadEmployees() {
      try {
        const response = await fetch(
          "http://localhost:8000/admin/users",
          { credentials: "include" }
        );

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        const data: Employee[] = await response.json();

        if (!cancelled) {
          setEmployees(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load employees."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadEmployees();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, canView]);

    async function handleToggleEmployee(employee: Employee) {
      if (user?.role !== "admin" || updatingEmployeeId) return;

      const action = employee.is_active ? "deactivate" : "reactivate";

      const confirmed = window.confirm(
        `Are you sure you want to ${action} ${employee.name}?`
      );

      if (!confirmed) return;

      setUpdatingEmployeeId(employee.id);
      setError("");

      try {
        const response = await fetch(
          `http://localhost:8000/admin/users/${employee.id}/${action}`,
          {
            method: "PATCH",
            credentials: "include",
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to ${action} employee (${response.status})`);
        }

        setEmployees((previous) =>
          previous.map((item) =>
            item.id === employee.id
              ? { ...item, is_active: !employee.is_active }
              : item
          )
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to update employee."
        );
      } finally {
        setUpdatingEmployeeId(null);
      }
    }

  if (
    authLoading ||
    !user ||
    user.must_change_password ||
    !canView
  ) {
    return <p className="p-8">Checking access...</p>;
  }

  const filteredEmployees = employees.filter((employee) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "active") return employee.is_active;
    return !employee.is_active;
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
    <div className="flex flex-wrap items-center justify-between gap-4">
    <div>
        <h1 className="text-3xl font-semibold">
        Employee Directory
        </h1>

        <p className="mt-2 text-gray-400">
        View company accounts, roles, and account status.
        </p>
    </div>

    {user.role === "admin" && (
        <button
        type="button"
        onClick={() => router.push("/employees/new")}
        className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
        >
        + Add Employee
        </button>
    )}
    </div>
      {loading && (
        <p className="mt-8">Loading employees...</p>
      )}

      {error && (
        <p role="alert" className="mt-8 text-red-400">
          {error}
        </p>
      )}

      {!loading && !error && (
        <>
          <div className="mt-8 flex flex-wrap gap-2">
            {[
              { label: "Active", value: "active" },
              { label: "Inactive", value: "inactive" },
              { label: "All", value: "all" },
            ].map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() =>
                  setStatusFilter(filter.value as StatusFilter)
                }
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  statusFilter === filter.value
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-900 text-gray-400 hover:bg-zinc-800"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="mt-6 overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-900 text-gray-400">
                <tr>
                  <th className="p-4">Name</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Status</th>

                  {user.role === "admin" && (
                    <th className="p-4">Actions</th>
                  )}

                </tr>
              </thead>

              <tbody>
                {filteredEmployees.map((employee) => (
                  <tr
                    key={employee.id}
                    onClick={() => router.push(`/employees/${employee.id}`)}
                    className="cursor-pointer border-t border-gray-800 transition-colors hover:bg-zinc-900"                    
                  >
                    <td className="p-4 font-medium">                 
                      {employee.name}
                    </td>

                    <td className="p-4 text-gray-400">
                      {employee.email}
                    </td>

                    <td className="p-4 capitalize">
                      {employee.role}
                    </td>

                    <td className="p-4">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-medium ${
                          employee.is_active
                            ? "bg-green-500/10 text-green-400"
                            : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {employee.is_active
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </td>
                    {user.role === "admin" && (
                      <td className="p-4">
                        {employee.role !== "admin" && (
                          <button
                            type="button"
                            //onClick={() => handleToggleEmployee(employee)}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleToggleEmployee(employee);
                            }}
                            disabled={updatingEmployeeId !== null}
                            className={`rounded-lg border px-3 py-2 text-xs font-medium disabled:opacity-50 ${
                              employee.is_active
                                ? "border-red-800 text-red-400 hover:bg-red-950"
                                : "border-green-800 text-green-400 hover:bg-green-950"
                            }`}
                          >
                            {updatingEmployeeId === employee.id
                              ? "Updating..."
                              : employee.is_active
                                ? "Deactivate"
                                : "Reactivate"}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredEmployees.length === 0 && (
              <p className="p-6 text-center text-gray-400">
                No employees found for this status.
              </p>
            )}
          </div>

          <p className="mt-4 text-sm text-gray-400">
            Showing {filteredEmployees.length} of{" "}
            {employees.length} accounts
          </p>
        </>
      )}
    </div>
  );
}
