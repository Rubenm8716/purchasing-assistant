
"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";

export default function ChangePasswordPage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);


    useEffect(() => {
    if (authLoading) return;

    if (!user) {
        router.replace("/login");
    } else if (!user.must_change_password) {
        router.replace("/");
    }
    }, [authLoading, user, router]);


  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 12) {
      setError("Your new password must contain at least 12 characters.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "http://localhost:8000/auth/change-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          typeof data?.detail === "string"
            ? data.detail
            : "Unable to change password."
        );
      }

      await refreshUser();
      router.replace("/");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || !user || !user.must_change_password) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p>Checking authentication...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-white">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4"
      >
        <h1 className="text-2xl font-bold">
          Change Your Password
        </h1>

        <p className="text-sm text-zinc-400">
          Create a new password before using the Purchasing Assistant.
        </p>

        <input
          type="password"
          placeholder="Current temporary password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="rounded-lg border border-zinc-700 bg-zinc-900 p-3"
        />

        <input
          type="password"
          placeholder="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          required
          className="rounded-lg border border-zinc-700 bg-zinc-900 p-3"
        />

        <input
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
          className="rounded-lg border border-zinc-700 bg-zinc-900 p-3"
        />

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-white p-3 font-medium text-black hover:bg-zinc-200 disabled:opacity-50"
        >
          {loading ? "Updating Password..." : "Change Password"}
        </button>
      </form>
    </main>
  );
}



//{
//  "name": "nanchie",
//  "email": "nanchie@gmail.com",
//  "role": "manager",
//  "temporary_password": "nanchie@8716"
//}

//{
//  "name": "glizzie",
//  "email": "glizzie@gmail.com",
//  "role": "employee",
//  "temporary_password": "glizzie@8716"
//  "new password": "Lovecookies@8716"
//}