
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";

    type CreatedEmployee = {
    name: string;
    email: string;
    role: "employee" | "manager";
    temporary_password: string;
    };  

export default function NewEmployeePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"employee" | "manager">("employee");
  //const [temporaryPassword, setTemporaryPassword] = useState("");
  const [createdEmployee, setCreatedEmployee] =
  useState<CreatedEmployee | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/login");
    } else if (user.must_change_password) {
      router.replace("/change-password");
    } else if (user.role !== "admin") {
      router.replace("/employees");
    }
  }, [authLoading, user, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (user?.role !== "admin" || saving) return;

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        "http://localhost:8000/admin/users",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            role,
            //temporary_password: temporaryPassword,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);

        throw new Error(
          typeof data?.detail === "string"
            ? data.detail
            : `Failed to create employee (${response.status})`
        );
      }

      //router.push("/employees");
      const data: CreatedEmployee = await response.json();
      setCreatedEmployee(data);
      



    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  if (
    authLoading ||
    !user ||
    user.must_change_password ||
    user.role !== "admin"
  ) {
    return <p className="p-8">Checking access...</p>;
  }


if (createdEmployee) {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="rounded-xl border border-gray-800 bg-zinc-900 p-6">
        <h1 className="text-2xl font-semibold text-green-400">
          Employee Created Successfully
        </h1>

        <p className="mt-3 text-gray-400">
          The account has been created. Save the temporary
          password before leaving this page.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <p className="text-sm text-gray-400">Name</p>
            <p className="font-medium">{createdEmployee.name}</p>
          </div>

          <div>
            <p className="text-sm text-gray-400">Email</p>
            <p className="font-medium">{createdEmployee.email}</p>
          </div>

          <div>
            <p className="text-sm text-gray-400">
              Temporary Password
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <code className="rounded-lg border border-gray-700 bg-zinc-950 px-4 py-3 font-mono">
                {createdEmployee.temporary_password}
              </code>

              <button
                type="button"
                onClick={() =>
                  navigator.clipboard.writeText(
                    createdEmployee.temporary_password
                  )
                }
                className="rounded-lg bg-blue-600 px-4 py-3 text-white hover:bg-blue-700"
              >
                Copy Password
              </button>
            </div>
          </div>
        </div>

        <p className="mt-6 text-sm text-amber-400">
          This password will only be shown once.
          The employee must change it at first login.
        </p>

        <button
          type="button"
          onClick={() => router.push("/employees")}
          className="mt-6 rounded-lg border border-gray-700 px-5 py-3 hover:bg-gray-800"
        >
          Return to Employee Directory
        </button>
      </div>
    </div>
  );
}


  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-semibold">
        Add Employee
      </h1>

      <p className="mt-2 text-gray-400">
        Create a new company account.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-8 space-y-6 rounded-xl border border-gray-800 bg-zinc-900 p-6"
      >
        <div>
          <label htmlFor="name" className="mb-2 block text-sm">
            Full Name
          </label>
          <input
            id="name"
            type="text"
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-zinc-950 px-4 py-3"
          />
        </div>

        <div>
          <label htmlFor="email" className="mb-2 block text-sm">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-zinc-950 px-4 py-3"
          />
        </div>

        <div>
          <label htmlFor="role" className="mb-2 block text-sm">
            Role
          </label>
          <select
            id="role"
            value={role}
            onChange={(e) =>
              setRole(e.target.value as "employee" | "manager")
            }
            className="w-full rounded-lg border border-gray-700 bg-zinc-950 px-4 py-3"
          >
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
          </select>
        </div>
        
        {/*
        <div>
          <label
            htmlFor="temporary-password"
            className="mb-2 block text-sm"
          >
            Temporary Password
          </label>
          <input
            id="temporary-password"
            type="password"
            required
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
            value={temporaryPassword}
            onChange={(e) => setTemporaryPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-zinc-950 px-4 py-3"
          />

          <p className="mt-2 text-xs text-gray-400">
            Must be at least 12 characters. The employee will
            be required to change it after their first login.
          </p>
        </div>
        */}


        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push("/employees")}
            className="rounded-lg border border-gray-700 px-5 py-2 text-gray-300 hover:bg-gray-800"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Employee"}
          </button>
        </div>
      </form>
    </div>
  );
}
