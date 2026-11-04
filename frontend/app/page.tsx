
"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const nextId = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const text = input.trim();

    if (!text || loading) return;

    const userMessage: Message = {
      id: nextId.current++,
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: text }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: nextId.current++,
        role: "assistant",
        content: data.response,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error(error);

      setMessages((prev) => [
        ...prev,
        {
          id: nextId.current++,
          role: "assistant",
          content: "Sorry, I couldn't connect to the server.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex h-screen flex-col bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-6 py-5">
        <h1 className="text-xl font-semibold">Purchasing Assistant</h1>
        <p className="text-sm text-zinc-400">
          Company Purchasing Management
        </p>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden px-4">
        <div className="flex-1 space-y-5 overflow-y-auto py-8">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <h2 className="mb-3 text-3xl font-semibold">
                What would you like to purchase?
              </h2>
              <p className="text-zinc-400">
                Ask about company purchases, spending policies,
                and approval requirements.
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === "user"
                  ? "justify-end"
                  : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  message.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-800 text-zinc-100"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-zinc-800 px-4 py-3 text-zinc-400">
                Assistant is typing...
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSubmit} className="border-t border-zinc-800 py-5">
          <div className="flex items-end gap-3 rounded-xl border border-zinc-700 bg-zinc-900 p-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a purchase..."
              rows={2}
              className="max-h-40 min-h-12 flex-1 resize-none bg-transparent p-2 text-white outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />

            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-lg bg-white px-5 py-3 font-medium text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
            </button>
          </div>

          <p className="mt-3 text-center text-xs text-zinc-500">
            This is only the demo.
          </p>
        </form>
      </section>
    </main>
  );
}
