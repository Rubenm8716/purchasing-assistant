
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";

import { MessageCircle, ShoppingCart, Pencil, Check, X } from "lucide-react";


type Conversation = {
  id: string;
  title: string;
  mode: "general" | "purchase";
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export default function ChatHistoryPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedTitle, setEditedTitle] = useState("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadConversations() {
      try {
        const response = await fetch("http://localhost:8000/conversations", {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to load conversations");
        }

        const data: { conversations: Conversation[] } = await response.json();

        setConversations(data.conversations);

        console.log("Loaded conversations:", data.conversations);

      } catch (error) {
        console.error(error);
        setError("Unable to load conversations.");
      } finally {
        setLoading(false);
      }
    }

    loadConversations();
  }, []);

  async function saveRename(conversationId: string) {
    const title = editedTitle.trim();

    if (!title || saving) return;

    setSaving(true);

    try {
      const response = await fetch(
        `http://localhost:8000/conversations/${conversationId}/rename`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to rename conversation");
      }

      setConversations((previous) =>
        previous.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, title, updated_at: new Date().toISOString() }
            : conversation
        )
      );

      setEditingId(null);
      setEditedTitle("");
    } catch (error) {
      console.error(error);
      window.alert("Unable to rename conversation. Please try again.");
    } finally {
      setSaving(false);
    }
  }



  return (
    <main className="p-8 text-white">
      <h1 className="text-2xl font-semibold">
        Chat History
      </h1>

      <p className="mt-2 text-zinc-400">
        View and manage your previous conversations.
      </p>
      <div className="mt-8 space-y-3">
        {loading ? (
          <p className="text-zinc-400">Loading conversations...</p>
        ) : error ? (
          <p className="text-red-400">{error}</p>
        ) : conversations.length === 0 ? (
          <p className="text-zinc-400">No conversations yet.</p>
        ) : (




          conversations.map((conversation) => (
            <div
              key={conversation.id}
              className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:bg-zinc-800"
            >
              {editingId === conversation.id ? (
                <div className="min-w-0 flex-1">
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    maxLength={100}
                    autoFocus
                    aria-label="New conversation title"
                    className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-blue-400"
                  />
                </div>
              ) : (
              <button
                type="button"
                disabled={!user}
                onClick={() => {
                if (!user) return;

                sessionStorage.setItem(
                  `activeConversationId:${user.id}`,
                  conversation.id
                );

                router.push("/");
              }}
              className="min-w-0 flex-1 cursor-pointer text-left disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                {conversation.mode === "purchase" ? (
                  <ShoppingCart size={20} className="text-blue-400" />
                ) : (
                  <MessageCircle size={20} className="text-zinc-400" />
                )}

              <h2 className="font-medium">{conversation.title}</h2>

              </div>
              <p className="mt-1 text-sm text-zinc-400">
                {conversation.mode === "purchase"
                  ? "Purchase Request"
                  : "General Question"}
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                Last updated: {new Date(conversation.updated_at).toLocaleString()}
              </p>
            </button>
            )}
            {editingId === conversation.id ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => saveRename(conversation.id)}
                  disabled={saving || !editedTitle.trim()}
                  aria-label="Save conversation title"
                  title="Save"
                  className="rounded-lg p-2 text-green-400 hover:bg-zinc-700 disabled:opacity-40"
                >
                  <Check size={18} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setEditedTitle("");
                  }}
                  disabled={saving}
                  aria-label="Cancel renaming"
                  title="Cancel"
                  className="rounded-lg p-2 text-red-400 hover:bg-zinc-700 disabled:opacity-40"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditingId(conversation.id);
                  setEditedTitle(conversation.title);
                }}
                disabled={!user || saving}
                aria-label={`Rename ${conversation.title}`}
                title="Rename conversation"
                className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-white"
              >
                <Pencil size={18} />
              </button>
            )}
            </div>
          ))
        )}
      </div>
    </main>
  );
}
