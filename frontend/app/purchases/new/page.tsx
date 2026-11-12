
"use client";

import { useEffect , useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";

export default function NewPurchasePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [jobName, setJobName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [afterTheFact, setAfterTheFact] = useState(false);  

  const [receipt, setReceipt] = useState<File | null>(null);
  const [itemPhoto, setItemPhoto] = useState<File | null>(null);  

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");  

  const [savedPurchaseId, setSavedPurchaseId] = useState<string | null>(null);

  const [receiptUploaded, setReceiptUploaded] = useState(false);
  const [itemPhotoUploaded, setItemPhotoUploaded] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
    } else if (user.must_change_password) {
      router.replace("/change-password");
    }
  }, [loading, user, router]);


    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;

    if (submitting) return;

    setSubmitting(true);
    setError("");
    setSuccess("");


    let purchaseId = savedPurchaseId;

    try {
        // let purchaseId = savedPurchaseId;

        if (!purchaseId) {
            const response = await fetch("http://localhost:8000/purchases", {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                source: "form",
                conversation_id: null,
                job_name: jobName.trim(),
                item_description: itemDescription.trim(),
                reason: reason.trim(),
                amount: Number(amount),
                after_the_fact: afterTheFact,
            }),
        });

        if (!response.ok) {
        const errorData = await response.json().catch(() => null);

            throw new Error(
                typeof errorData?.detail === "string"
                ? errorData.detail
                : `Server returned ${response.status}`
            );
            }

            const savedPurchase = await response.json();

            purchaseId = savedPurchase.id;
            setSavedPurchaseId(purchaseId);
        }

        if (!purchaseId) {
            throw new Error("Unable to determine purchase ID.");
        }



        // Upload a file associated with this purchase
        async function uploadEvidence(
        file: File,
        evidenceType: "receipt" | "item_photo"
        ) {
        const formData = new FormData();

        formData.append("evidence_type", evidenceType);
        formData.append("file", file);

        const uploadResponse = await fetch(
            `http://localhost:8000/purchases/${purchaseId}/evidence`,
            {
            method: "POST",
            credentials: "include",
            body: formData,
            }
        );

            if (!uploadResponse.ok) {
                throw new Error(`Failed to upload ${evidenceType}.`);
            }
        }

        // Upload receipt if provided
        if (receipt && !receiptUploaded) {
            await uploadEvidence(receipt, "receipt");
            setReceiptUploaded(true);
        }

        if (itemPhoto && !itemPhotoUploaded) {
            await uploadEvidence(itemPhoto, "item_photo");
            setItemPhotoUploaded(true);
        }

        // setSuccess(`Purchase saved! ID: ${savedPurchase.id}`);

        setSuccess(`Purchase saved! ID: ${purchaseId}`);
        setSavedPurchaseId(null);
        setReceiptUploaded(false);
        setItemPhotoUploaded(false);


        form.reset();

        setReceipt(null);
        setItemPhoto(null);

        setJobName("");
        setItemDescription("");
        setReason("");
        setAmount("");
        setAfterTheFact(false);
    } catch (err) {

        const message =
            err instanceof Error ? err.message : "Something went wrong.";

        if (purchaseId) {
            setError(
                `Purchase ${purchaseId} was saved, but evidence upload may be incomplete: ${message}. Click Submit again to retry.`
                //`Purchase was saved, but an upload failed: ${message}. Click Submit again to retry.`
            );
        } else {
            setError(message);
        }

    } finally {
        setSubmitting(false);
    }
    }




  if (loading || !user || user.must_change_password) {
    return <p className="p-8">Checking authentication...</p>;
  }

  return (
    <main className="w-full max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold">
        New Purchase
      </h1>

      <p className="mt-2">
        Welcome, {user.name}.
      </p>

        <form onSubmit={handleSubmit} className="mt-8 w-full space-y-5">
        <div>
            <label className="block mb-2">Job / Project</label>
            <input
            type="text"
            required
            disabled={submitting || !!savedPurchaseId}
            value={jobName}
            onChange={(e) => setJobName(e.target.value)}
            placeholder="Dallas Corporate Event"
            className="w-full rounded border p-3 text-white"
            />
        </div>

        <div>
            <label className="block mb-2">Item Description</label>
            <input
            type="text"
            required
            disabled={submitting || !!savedPurchaseId}
            value={itemDescription}
            onChange={(e) => setItemDescription(e.target.value)}
            placeholder="Wood screws"
            className="w-full rounded border p-3 text-white"
            />
        </div>

        <div>
            <label className="block mb-2">Reason for Purchase</label>
            <textarea
            required
            disabled={submitting || !!savedPurchaseId}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Needed to assemble temporary walls"
            className="w-full rounded border p-3 text-white"
            />
        </div>

        <div>
            <label className="block mb-2">Amount ($)</label>
            <input
            type="number"
            min="0"
            step="0.01"
            required
            disabled={submitting || !!savedPurchaseId}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="35.50"
            className="w-full rounded border p-3 text-white"
            />
        </div>

        <label className="flex items-center gap-3">
            <input
            type="checkbox"
            disabled={submitting || !!savedPurchaseId}
            checked={afterTheFact}
            // onChange={(e) => setAfterTheFact(e.target.checked)}
            onChange={(e) => {
                setAfterTheFact(e.target.checked);

                if (!e.target.checked) {
                    setReceipt(null);
                    setItemPhoto(null);
                }
            }}            

            />
            I have already purchased this item.
        </label>

        {afterTheFact && (
        <>
            <div>
            <label className="block mb-2">
                Receipt
            </label>

            <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                disabled={submitting || receiptUploaded}
                onChange={(e) =>
                setReceipt(e.target.files?.[0] ?? null)
                }
                className="w-full rounded border p-3"
            />
            </div>

            <div>
            <label className="block mb-2">
                Photo of Purchased Items
            </label>

            <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={submitting || itemPhotoUploaded}
                onChange={(e) =>
                setItemPhoto(e.target.files?.[0] ?? null)
                }
                className="w-full rounded border p-3"
            />
            </div>
        </>
        )}

        <button
        type="submit"
        disabled={submitting}
        className="rounded bg-blue-600 px-5 py-3 text-white disabled:opacity-50"
        >


        {submitting
        ? "Saving..."
        : savedPurchaseId
        ? "Retry Uploads"
        : "Submit Purchase"}


        </button>

        {error && (
        <p role="alert" className="text-red-400">
            {error}
        </p>
        )}

        {success && (
        <p role="status" className="text-green-400">
            {success}
        </p>
        )}

        </form>
    </main>
  );
}
