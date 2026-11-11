
"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";

export default function LoginPage() {
    const { refreshUser } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        // "http://127.0.0.1:8000/auth/login",
        "http://localhost:8000/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      if (!response.ok) {
        setError("Invalid credentials or account unavailable.");
        return;
      }

      const data = await response.json();

      // Update the shared authentication state.
      await refreshUser();

      // Redirect based on password-change requirements.
      if (data.user.must_change_password) {
        window.location.href = "/change-password";
      } else {
        window.location.href = "/";
      }
    } catch {
      console.error("Login failed:", error);
      setError("Unable to complete login. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4"
      >
        <h1 className="text-2xl font-bold">
          Purchasing Assistant
        </h1>

        <p>Sign in to your account</p>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          className="rounded border border-gray-600 bg-white p-3 text-black placeholder:text-gray-500"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          className="rounded border border-gray-600 bg-white p-3 text-black placeholder:text-gray-500"
        />

        {error && (
          <p className="text-red-500">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-blue-600 p-3 text-white disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </main>
  );
}
