
"use client";

import { useState } from "react";

export default function Home() {
  const [message, setMessage] = useState("");

  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!message.trim()) return;

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/purchase",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: message,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Backend request failed");
      }

      const data = await response.json();

      alert(data.response);
    } catch (error) {
      console.error(error);
      alert("Could not connect to the backend.");
    }
  }


  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 p-6">
        <h1 className="text-2xl font-bold">
          Purchasing Assistant
        </h1>
        <p className="text-sm text-zinc-400">
          Company Purchasing Management
        </p>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-24">
        <h2 className="mb-4 text-4xl font-semibold">
          What would you like to purchase?
        </h2>

        <p className="mb-8 text-zinc-400">
          Ask about company purchases, spending policies,
          and approval requirements.
        </p>

        <form onSubmit={handleSubmit}>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Example: Can I buy a $150 drill for tomorrow's installation?"
            className="h-36 w-full rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-white outline-none focus:border-blue-500"
          />

          <button
            type="submit"
            className="mt-4 rounded-lg bg-white px-6 py-3 font-medium text-black hover:bg-zinc-200"
          >
            Ask Assistant
          </button>
        </form>

        <p className="mt-8 text-sm text-zinc-500">
          All purchases are subject to company policy.
        </p>
      </section>
    </main>
  );
}
