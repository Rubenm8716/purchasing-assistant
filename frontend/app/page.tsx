
"use client";

// import { useState, useRef, useEffect, type FormEvent } from "react";
import { useState, useRef, useEffect, type FormEvent } from "react";

import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";

type Attachment = {
  id: string;
  name: string;
  size: number;
  type: string;
};

// GoodPassword111

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
};

export default function Home() {

  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/login");
    } else if (user.must_change_password) {
    router.replace("/change-password");
    }
  }, [authLoading, user, router]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const nextId = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files ?? []);
    setAttachments((prev) => [...prev, ...selectedFiles]);
    e.target.value = "";
  }

function removeAttachment(index: number) {
  setAttachments((prev) => prev.filter((_, i) => i !== index));
}

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const text = input.trim();

    //if (!text || loading) return;
    if ((!text && attachments.length === 0) || loading) return;


    const selectedFiles = [...attachments];

    /*const userMessage: Message = {
      id: nextId.current++,
      role: "user",
      content: text,
    };*/

    const userMessage: Message = {
      id: nextId.current++,
      role: "user",
      content: text,
      // attachments: selectedFiles.map((file) => ({
      //attachments: attachments.map((file) => ({
      attachments: selectedFiles.map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
      })),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setAttachments([]);
    setLoading(true);











    try {









      // const response = await fetch("http://127.0.0.1:8000/chat", {
      //  method: "POST",
      //  headers: {
      //    "Content-Type": "application/json",
      //  },

      //body: JSON.stringify({messages: [...messages, userMessage].map(({ role, content }) => ({role, content,})),}),});
      //  body: JSON.stringify({
      //  messages: [...messages, userMessage].map((message) => ({
      //  role: message.role,
      //  content:
      //  message.content ||
      //  (message.attachments?.length
      //    ? `[Attached ${message.attachments.length} file(s) — not uploaded]`
      //    : ""),
      //      })),
      //    }),
      //  });



        // Create the multipart request body
        const formData = new FormData();

        // Prepare conversation history
        const conversation = [...messages, userMessage].map((message) => ({
          role: message.role,
          content:
            message.content ||
            (message.attachments?.length
              ? `[Attached ${message.attachments.length} file(s)]`
              : ""),
        }));

        // Add the conversation history as JSON text
        formData.append(
          "messages",
          JSON.stringify({ messages: conversation })
        );

        // Add actual file bytes
        selectedFiles.forEach((file) => {
          formData.append("receipts", file);
        });

        // Send request to FastAPI
        //const response = await fetch("http://127.0.0.1:8000/chat", {
        const response = await fetch("http://localhost:8000/chat", {
          method: "POST",
          credentials: "include",
          body: formData,
        });












      // if (!response.ok) {
      //  throw new Error(`Server returned ${response.status}`);
      //}

      if (!response.ok) {
        const errorData = await response.json();

        throw new Error(
          typeof errorData.detail === "string"
            ? errorData.detail
            : `Server returned ${response.status}`
        );
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
          // content: "Sorry, I couldn't connect to the server.",
          content:
            error instanceof Error
              ? error.message
              : "Something went wrong.",


        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await logout();
      router.replace("/login");
    } catch (error) {
      console.error("Logout failed:", error);
      alert("Unable to log out. Please try again.");
    }
  }

  if (authLoading || !user || user.must_change_password) {
      return (
      <main className="flex h-screen items-center justify-center bg-zinc-950 text-white">
        <p>Checking authentication...</p>
      </main>
    );
  }
      return (
        <main className="flex h-screen flex-col bg-zinc-950 text-white">




          <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-5">
            <div>
            <h1 className="text-xl font-semibold">Purchasing Assistant</h1>
            <p className="text-sm text-zinc-400">
              Company Purchasing Management
            </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-zinc-400">
                {user.name}
              </span>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800"
              >
                Logout
              </button>
            </div>
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
                    <div className="space-y-2">
                    {message.content && (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}

                    {message.attachments?.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="rounded-lg border border-white/20 px-3 py-2 text-sm"
                      >
                        📎 {attachment.name}
                        <span className="ml-2 text-xs opacity-60">
                          {(attachment.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    ))}
                  </div>


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

              {attachments.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {attachments.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm"
                    >
                      <span>📎 {file.name}</span>

                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="text-zinc-400 hover:text-white"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-3 rounded-xl border border-zinc-700 bg-zinc-900 p-3">



                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={handleFilesSelected}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg p-3 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                  title="Attach files"
                >
                  📎
                </button>

                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about a purchase..."
                  rows={2}
                  //className="max-h-40 min-h-12 flex-1 resize-none bg-transparent p-2 text-white outline-none"
                  className="min-w-0 max-h-40 min-h-12 flex-1 resize-none bg-transparent p-2 text-white outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                />

                <button
                  type="submit"
                  disabled={loading || (!input.trim() && attachments.length === 0)}
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
