
"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";

type Purchase = {
  id: string;
  job_name: string;
  item_description: string;
  reason: string;
  amount: number;
  status: string;
  recommendation: string;
  source: "chat" | "form";
  after_the_fact: boolean;
  created_at: string;
  has_receipt: boolean;
  has_item_photo: boolean;
  missing_receipt: boolean;
  missing_item_photo: boolean;
  needs_review: boolean;
};


type Evidence = {
  id: string;
  evidence_type: "receipt" | "item_photo";
  file_name: string;
  content_type: string;
};

type ReviewNote = {
  id: string;
  purchase_request_id: string;
  author_id: string;
  author_name: string;
  content: string;
  created_at: string;
};

type ReviewHistory = {
  id: string;
  old_status: string;
  new_status: string;
  reason: string;
  changed_at: string;
  changed_by_name: string;
};

// Evidence Display Content
function EvidencePreview({
  purchaseId,
  file,
}: {
  purchaseId: string;
  file: Evidence;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;

    async function loadFile() {
      setPreviewUrl(null);
      setError("");

      try {
        const response = await fetch(
          `http://localhost:8000/purchases/${purchaseId}/evidence/${file.id}/file`,
          {
            credentials: "include",
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error("Unable to load file.");
        }

        const blob = await response.blob();

        if (controller.signal.aborted) return;

        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError("Unable to display this file.");
        }
      }
    }

    void loadFile();

    return () => {
      controller.abort();

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [purchaseId, file.id]);

  if (error) {
    return <p className="mt-2 text-sm text-red-400">{error}</p>;
  }

  if (!previewUrl) {
    return <p className="mt-2 text-sm text-gray-400">Loading preview...</p>;
  }

  return (
    <div className="mt-3">
      {file.content_type.startsWith("image/") ? (
        <a href={previewUrl} target="_blank" rel="noopener noreferrer">
          {/* Blob URLs are created from authenticated file responses. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={file.file_name}
            className="h-48 w-full rounded-lg border border-gray-800 object-contain"
          />
        </a>
      ) : (
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-400 hover:underline"
        >
          Open PDF
        </a>
      )}
    </div>
  );
}


//export default function PurchaseDetailsPage() {
function PurchaseDetailsContent() {    
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams<{ purchaseId: string }>();

  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(true);
  const [evidenceError, setEvidenceError] = useState("");

  const [reviewNotes, setReviewNotes] = useState<ReviewNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [notesError, setNotesError] = useState("");

  const [reviewHistory, setReviewHistory] = useState<ReviewHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");


  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [saveNoteError, setSaveNoteError] = useState("");



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

  async function loadEvidence() {
    setEvidenceLoading(true);
    setEvidenceError("");

    try {
      const response = await fetch(
        `http://localhost:8000/purchases/${params.purchaseId}/evidence`,
        { credentials: "include" }
      );

      if (!response.ok) {
        throw new Error(
          `Unable to load evidence (${response.status})`
        );
      }

      const data: Evidence[] = await response.json();

      if (!cancelled) {
        setEvidence(data);
      }
    } catch (err) {
      if (!cancelled) {
        setEvidenceError(
          err instanceof Error
            ? err.message
            : "Unable to load evidence."
        );
      }
    } finally {
      if (!cancelled) {
        setEvidenceLoading(false);
      }
    }
  }

  void loadEvidence();

  return () => {
    cancelled = true;
  };
}, [authLoading, user, canView, params.purchaseId]);



  // Fetch investigation notes
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

    async function loadReviewNotes() {
      setNotesLoading(true);
      setNotesError("");

      try {
        const response = await fetch(
          `http://localhost:8000/purchases/${params.purchaseId}/review-notes`,
          { credentials: "include" }
        );

        if (!response.ok) {
          throw new Error(
            `Unable to load review notes (${response.status})`
          );
        }

        const data: ReviewNote[] = await response.json();

        if (!cancelled) {
          setReviewNotes(data);
        }
      } catch (err) {
        if (!cancelled) {
          setNotesError(
            err instanceof Error
              ? err.message
              : "Unable to load review notes."
          );
        }
      } finally {
        if (!cancelled) {
          setNotesLoading(false);
        }
      }
    }

    void loadReviewNotes();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, canView, params.purchaseId]);




  // Fetch review history
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

    async function loadReviewHistory() {
      setHistoryLoading(true);
      setHistoryError("");

      try {
        const response = await fetch(
          `http://localhost:8000/purchases/${params.purchaseId}/review-history`,
          { credentials: "include" }
        );

        if (!response.ok) {
          throw new Error(
            `Unable to load review history (${response.status})`
          );
        }

        const data: ReviewHistory[] = await response.json();

        if (!cancelled) {
          setReviewHistory(data);
        }
      } catch (err) {
        if (!cancelled) {
          setHistoryError(
            err instanceof Error
              ? err.message
              : "Unable to load review history."
          );
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    }

    void loadReviewHistory();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, canView, params.purchaseId]);  


  // Fetch purchase information
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


    async function loadPurchase() {
      try {
        const response = await fetch(
          `http://localhost:8000/purchases/${params.purchaseId}`,
          { credentials: "include" }
        );

        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? "Purchase not found."
              : `Server returned ${response.status}`
          );
        }

        const data: Purchase = await response.json();

        if (!cancelled) {
          setPurchase(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load purchase."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPurchase();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, canView, params.purchaseId]);



  async function handleSaveNote() {
    const content = newNote.trim();

    if (!content || savingNote) return;

    setSavingNote(true);
    setSaveNoteError("");

    try {
      const response = await fetch(
        `http://localhost:8000/purchases/${params.purchaseId}/review-notes`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content }),
        }
      );

      if (!response.ok) {
        throw new Error(`Unable to save note (${response.status})`);
      }

      setNewNote("");

      const notesResponse = await fetch(
        `http://localhost:8000/purchases/${params.purchaseId}/review-notes`,
        { credentials: "include" }
      );

      if (!notesResponse.ok) {
        throw new Error("Note saved, but unable to refresh notes.");
      }

      const updatedNotes: ReviewNote[] = await notesResponse.json();
      setReviewNotes(updatedNotes);
    } catch (err) {
      setSaveNoteError(
        err instanceof Error ? err.message : "Unable to save note."
      );
    } finally {
      setSavingNote(false);
    }
  }

  if (authLoading || !user ||
      user.must_change_password || !canView) {
    return <p className="p-8">Checking access...</p>;
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <Link
        href="/dashboard"
        className="text-sm text-gray-400 hover:text-white"
      >
        ← Back to Dashboard
      </Link>

      {loading && <p className="mt-8">Loading purchase...</p>}

      {error && (
        <p role="alert" className="mt-8 text-red-400">
          {error}
        </p>
      )}

      {!loading && !error && purchase && (
        <>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold">
                {purchase.item_description}
              </h1>
              <p className="mt-2 text-gray-400">
                {purchase.job_name}
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-sm ${
                purchase.needs_review
                  ? "bg-amber-500/10 text-amber-400"
                  : "bg-green-500/10 text-green-400"
              }`}
            >
              {purchase.needs_review
                ? "Needs Review"
                : "No Review Flag"}
            </span>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-800 p-5">
              <p className="text-sm text-gray-400">Amount</p>
              <p className="mt-2 text-2xl font-semibold">
                ${Number(purchase.amount).toFixed(2)}
              </p>
            </div>

            <div className="rounded-xl border border-gray-800 p-5">
              <p className="text-sm text-gray-400">Purchase Status</p>
              <p className="mt-2 text-xl font-semibold capitalize">
                {purchase.status}
              </p>
            </div>
          </div>

          <section className="mt-8 rounded-xl border border-gray-800 p-6">
            <h2 className="text-xl font-semibold">
              Purchase Information
            </h2>

            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="text-gray-400">Reason</dt>
                <dd className="mt-1">{purchase.reason}</dd>
              </div>

              <div>
                <dt className="text-gray-400">Source</dt>
                <dd className="mt-1 capitalize">
                  {purchase.source}
                </dd>
              </div>

              <div>
                <dt className="text-gray-400">Recommendation</dt>
                <dd className="mt-1 capitalize">
                  {purchase.recommendation}
                </dd>
              </div>

              <div>
                <dt className="text-gray-400">Submitted</dt>
                <dd className="mt-1">
                  {new Date(purchase.created_at).toLocaleString()}
                </dd>
              </div>

              <div>
                <dt className="text-gray-400">After-the-fact purchase</dt>
                <dd className="mt-1">
                  {purchase.after_the_fact ? "Yes" : "No"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="mt-6 rounded-xl border border-gray-800 p-6">
            <h2 className="text-xl font-semibold">
              Purchase Evidence
            </h2>

            {evidenceLoading && (
              <p className="mt-4 text-gray-400">
                Loading evidence...
              </p>
            )}

            {evidenceError && (
              <p role="alert" className="mt-4 text-red-400">
                {evidenceError}
              </p>
            )}

            {!evidenceLoading && !evidenceError && (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {(["receipt", "item_photo"] as const).map((type) => {
                  const files = evidence.filter(
                    (file) => file.evidence_type === type
                  );

                  return (
                    <div
                      key={type}
                      className="rounded-lg border border-gray-800 p-4"
                    >
                      <h3 className="font-medium">
                        {type === "receipt" ? "Receipt" : "Item Photo"}
                      </h3>

                      {files.length === 0 ? (
                        <p className="mt-3 text-sm text-amber-400">
                          Not uploaded
                        </p>
                      ) : (
                        <div className="mt-3 space-y-2">
                          {files.map((file) => (
                            <div key={file.id}>
                              <p className="break-all text-sm text-gray-300">
                                {file.file_name}
                              </p>

                              <p className="mt-1 text-xs text-green-400">
                                Uploaded
                              </p>

                              <EvidencePreview
                                purchaseId={params.purchaseId}
                                file={file}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          {/* Investigation Notes */}
          <section className="mt-6 rounded-xl border border-gray-800 p-6">
            <h2 className="text-xl font-semibold">
              Investigation Notes
            </h2>

            {notesLoading && (
              <p className="mt-4 text-gray-400">
                Loading notes...
              </p>
            )}

            {notesError && (
              <p className="mt-4 text-red-400">
                {notesError}
              </p>
            )}

            {!notesLoading && !notesError && (
              <div className="mt-5 space-y-4">
                {reviewNotes.length === 0 ? (
                  <p className="text-gray-400">
                    No investigation notes yet.
                  </p>
                ) : (
                  reviewNotes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-lg border border-gray-800 p-4"
                    >
                      <div className="flex flex-wrap justify-between gap-2">
                        <p className="font-medium">
                          {note.author_name}
                        </p>

                        <p className="text-sm text-gray-400">
                          {new Date(note.created_at).toLocaleString()}
                        </p>
                      </div>

                      <p className="mt-3 whitespace-pre-wrap text-sm">
                        {note.content}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
            {/* Write a new investigation note */}
            <div className="mt-6 border-t border-gray-800 pt-5">
              <label
                htmlFor="new-investigation-note"
                className="mb-2 block text-sm font-medium"
              >
                Add Investigation Note
              </label>

              <textarea
                id="new-investigation-note"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Document a conversation, explanation, or finding..."
                maxLength={5000}
                rows={3}
                disabled={savingNote}
                className="w-full rounded-lg border border-gray-700 bg-transparent p-3 text-sm text-white outline-none focus:border-blue-500"
              />

              {saveNoteError && (
                <p role="alert" className="mt-2 text-sm text-red-400">
                  {saveNoteError}
                </p>
              )}

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveNote}
                  disabled={!newNote.trim() || savingNote}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingNote ? "Saving..." : "Save Note"}
                </button>
              </div>
            </div>
          </section>

          {/* Review History */}
          <section className="mt-6 rounded-xl border border-gray-800 p-6">
            <h2 className="text-xl font-semibold">
              Review History
            </h2>

            {historyLoading && (
              <p className="mt-4 text-gray-400">
                Loading review history...
              </p>
            )}

            {historyError && (
              <p className="mt-4 text-red-400">
                {historyError}
              </p>
            )}

            {!historyLoading && !historyError && (
              <div className="mt-5 space-y-4">
                {reviewHistory.length === 0 ? (
                  <p className="text-gray-400">
                    No review status changes yet.
                  </p>
                ) : (
                  reviewHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-lg border border-gray-800 p-4"
                    >
                      <p className="font-medium">
                        {entry.old_status.replaceAll("_", " ")}
                        {" → "}
                        {entry.new_status.replaceAll("_", " ")}
                      </p>

                      <p className="mt-2 text-sm text-gray-400">
                        Changed by {entry.changed_by_name}
                        {" • "}
                        {new Date(entry.changed_at).toLocaleString()}
                      </p>

                      <p className="mt-3 whitespace-pre-wrap text-sm">
                        {entry.reason}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>


          {/* Purchase Flags */}
          {purchase.needs_review && (
            <section className="mt-6 rounded-xl border border-amber-900/50 p-6">
              <h2 className="text-xl font-semibold">
                Review Flags
              </h2>

              <div className="mt-4 space-y-2 text-amber-400">
                {purchase.after_the_fact && (
                  <p>Purchase recorded after the fact.</p>
                )}

                {purchase.missing_receipt && (
                  <p>Receipt is missing.</p>
                )}

                {purchase.missing_item_photo && (
                  <p>Photo of purchased items is missing.</p>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default function PurchaseDetailsPage() {
  return (
    <Suspense fallback={<p className="p-8">Loading purchase...</p>}>
      <PurchaseDetailsContent />
    </Suspense>
  );
}
