
from decimal import Decimal
from typing import Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from psycopg.rows import dict_row

from app.database import get_connection
from app.permissions import require_password_changed

from pathlib import Path

from fastapi import File, Form, UploadFile

from fastapi.responses import FileResponse


router = APIRouter(prefix="/purchases", tags=["Purchases"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
}


def validate_upload(file: UploadFile, content: bytes):
    if not content:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty."
        )

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="File exceeds the 10 MB limit."
        )

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type."
        )

class PurchaseCreate(BaseModel):
    source: Literal["chat", "form"]
    conversation_id: UUID | None = None

    job_name: str = Field(min_length=1)
    item_description: str = Field(min_length=1)
    reason: str = Field(min_length=1)
    amount: Decimal = Field(ge=0, max_digits=12, decimal_places=2)

    after_the_fact: bool = False


class ReviewNoteCreate(BaseModel):
    content: str = Field(min_length=1, max_length=5000)


class ReviewStatusUpdate(BaseModel):
    review_status: Literal[
        "pending",
        "in_progress",
        "resolved"
    ]
    reason: str = Field(min_length=1, max_length=5000)


class AccountingCheckUpdate(BaseModel):
    status: Literal["pending", "passed", "failed"]
    reason: str = Field(min_length=1, max_length=5000)


class PurchaseComplete(BaseModel):
    final_amount: Decimal = Field(
        ge=0,
        max_digits=12,
        decimal_places=2
    )


@router.post("", status_code=201)
def create_purchase(
    purchase: PurchaseCreate,
    current_user: dict = Depends(require_password_changed)
):
    if purchase.source == "chat" and purchase.conversation_id is None:
        raise HTTPException(
            status_code=422,
            detail="Chat purchases require a conversation ID."
        )

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cursor:

            if purchase.conversation_id is not None:
                cursor.execute(
                    """
                    SELECT id
                    FROM conversations
                    WHERE id = %s AND user_id = %s
                    """,
                    (purchase.conversation_id, current_user["id"])
                )

                if cursor.fetchone() is None:
                    raise HTTPException(
                        status_code=404,
                        detail="Conversation not found."
                    )


            cursor.execute(
                """
                INSERT INTO purchase_requests (
                    user_id,
                    conversation_id,
                    source,
                    job_name,
                    item_description,
                    reason,
                    amount,
                    after_the_fact,
                    status,
                    review_status
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    current_user["id"],
                    purchase.conversation_id,
                    purchase.source,
                    purchase.job_name,
                    purchase.item_description,
                    purchase.reason,
                    purchase.amount,

                    purchase.source == "form",
                    "purchased" if purchase.source == "form" else "requested",
                    "pending" if purchase.source == "form" else "not_required"

                    #purchase.after_the_fact,
                    #"purchased" if purchase.after_the_fact else "requested",
                    #"pending" if purchase.after_the_fact else "not_required"
                )
            )

            saved_purchase = cursor.fetchone()
            # Create accounting checks for completed purchases
            if saved_purchase["status"] == "purchased":
                cursor.execute(
                    """
                    INSERT INTO purchase_accounting_checks (
                        purchase_request_id,
                        check_type
                    )
                    VALUES
                        (%s, 'receipt'),
                        (%s, 'item_photo'),
                        (%s, 'bank_match')
                    """,
                    (
                        saved_purchase["id"],
                        saved_purchase["id"],
                        saved_purchase["id"]
                    )
                )


    return saved_purchase




@router.post("/{purchase_id}/complete")
def complete_purchase(
    purchase_id: UUID,
    completion: PurchaseComplete,
    current_user: dict = Depends(require_password_changed)
):
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cursor:

            cursor.execute(
                """
                SELECT id, source, status
                FROM purchase_requests
                WHERE id = %s AND user_id = %s
                FOR UPDATE
                """,
                (purchase_id, current_user["id"])
            )

            purchase = cursor.fetchone()

            if purchase is None:
                raise HTTPException(
                    status_code=404,
                    detail="Purchase request not found."
                )

            if purchase["source"] != "chat":
                raise HTTPException(
                    status_code=400,
                    detail="Only chat purchases require completion."
                )

            if purchase["status"] != "requested":
                raise HTTPException(
                    status_code=409,
                    detail="Purchase has already been completed or cancelled."
                )

            cursor.execute(
                """
                SELECT
                    EXISTS (
                        SELECT 1 FROM purchase_evidence
                        WHERE purchase_request_id = %s
                          AND evidence_type = 'receipt'
                    ) AS has_receipt,
                    EXISTS (
                        SELECT 1 FROM purchase_evidence
                        WHERE purchase_request_id = %s
                          AND evidence_type = 'item_photo'
                    ) AS has_item_photo
                """,
                (purchase_id, purchase_id)
            )

            evidence = cursor.fetchone()

            review_status = (
                "not_required"
                if evidence["has_receipt"] and evidence["has_item_photo"]
                else "pending"
            )

            cursor.execute(
                """
                UPDATE purchase_requests
                SET status = 'purchased',
                    amount = %s,
                    review_status = %s,
                    updated_at = NOW()
                WHERE id = %s
                RETURNING *
                """,
                (completion.final_amount, review_status, purchase_id)
            )

            completed_purchase = cursor.fetchone()
            # Create accounting checks when a chat purchase is completed
            cursor.execute(
                """
                INSERT INTO purchase_accounting_checks (
                    purchase_request_id,
                    check_type
                )
                VALUES
                    (%s, 'receipt'),
                    (%s, 'item_photo'),
                    (%s, 'bank_match')
                """,
                (
                    completed_purchase["id"],
                    completed_purchase["id"],
                    completed_purchase["id"]
                )
            )
    return completed_purchase





@router.get("")
def list_purchases(
    current_user: dict = Depends(require_password_changed)
):
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cursor:

            if current_user["role"] in ("admin", "manager"):
                cursor.execute(
                    #"""
                    #SELECT *
                    #FROM purchase_requests
                    #ORDER BY created_at DESC
                    #LIMIT 100
                    #"""

                    """
                    SELECT
                        p.*,

                        EXISTS (
                            SELECT 1
                            FROM purchase_evidence e
                            WHERE e.purchase_request_id = p.id
                              AND e.evidence_type = 'receipt'
                        ) AS has_receipt,

                        EXISTS (
                            SELECT 1
                            FROM purchase_evidence e
                            WHERE e.purchase_request_id = p.id
                              AND e.evidence_type = 'item_photo'
                        ) AS has_item_photo

                    FROM purchase_requests p
                    ORDER BY p.created_at DESC
                    LIMIT 100
                    """                    
                )
            else:
                cursor.execute(
                    #"""
                    #SELECT *
                    #FROM purchase_requests
                    #WHERE user_id = %s
                    #ORDER BY created_at DESC
                    #LIMIT 100
                    #""",
                    """
                    SELECT
                        p.*,

                        EXISTS (
                            SELECT 1
                            FROM purchase_evidence e
                            WHERE e.purchase_request_id = p.id
                            AND e.evidence_type = 'receipt'
                        ) AS has_receipt,

                        EXISTS (
                            SELECT 1
                            FROM purchase_evidence e
                            WHERE e.purchase_request_id = p.id
                            AND e.evidence_type = 'item_photo'
                        ) AS has_item_photo

                    FROM purchase_requests p
                    WHERE p.user_id = %s
                    ORDER BY p.created_at DESC
                    LIMIT 100
                    """,
                    (current_user["id"],)
                )

            purchases = cursor.fetchall()

        for purchase in purchases:
            is_purchased = purchase["status"] == "purchased"

            purchase["missing_receipt"] = (
                is_purchased and not purchase["has_receipt"]
                )

            purchase["missing_item_photo"] = (
                is_purchased and not purchase["has_item_photo"]
                )

            purchase["needs_review"] = (
                purchase["after_the_fact"]
                or purchase["missing_receipt"]
                or purchase["missing_item_photo"]
            )

    return purchases



@router.get("/{purchase_id}")
def get_purchase(
    purchase_id: UUID,
    current_user: dict = Depends(require_password_changed)
):
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cursor:

            if current_user["role"] in ("admin", "manager"):
                cursor.execute(
                    """            
                    SELECT
                        p.*,

                        EXISTS (
                            SELECT 1
                            FROM purchase_evidence e
                            WHERE e.purchase_request_id = p.id
                            AND e.evidence_type = 'receipt'
                        ) AS has_receipt,

                        EXISTS (
                            SELECT 1
                            FROM purchase_evidence e
                            WHERE e.purchase_request_id = p.id
                            AND e.evidence_type = 'item_photo'
                        ) AS has_item_photo

                    FROM purchase_requests p
                    WHERE p.id = %s
                    """,
                    (purchase_id,)
                )
            else:
                cursor.execute(
                    """
                    SELECT
                        p.*,

                        EXISTS (
                            SELECT 1
                            FROM purchase_evidence e
                            WHERE e.purchase_request_id = p.id
                            AND e.evidence_type = 'receipt'
                        ) AS has_receipt,

                        EXISTS (
                            SELECT 1
                            FROM purchase_evidence e
                            WHERE e.purchase_request_id = p.id
                            AND e.evidence_type = 'item_photo'
                        ) AS has_item_photo

                    FROM purchase_requests p
                    WHERE p.id = %s AND p.user_id = %s
                    """,
                    (purchase_id, current_user["id"])
                )

            purchase = cursor.fetchone()

    if purchase is None:
        raise HTTPException(
            # Avoids confirming if purchase actually exists
            status_code=404,
            detail="Purchase not found."
        )

    # return purchase
    is_purchased = purchase["status"] == "purchased"

    purchase["missing_receipt"] = (
        is_purchased and not purchase["has_receipt"]
    )

    purchase["missing_item_photo"] = (
        is_purchased and not purchase["has_item_photo"]
    )

    purchase["needs_review"] = (
        purchase["after_the_fact"]
        or purchase["missing_receipt"]
        or purchase["missing_item_photo"]
    )

    return purchase



@router.post("/{purchase_id}/evidence", status_code=201)
async def upload_purchase_evidence(
    purchase_id: UUID,
    evidence_type: Literal["receipt", "item_photo"] = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(require_password_changed)
):
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                """
                SELECT id
                FROM purchase_requests
                WHERE id = %s AND user_id = %s
                """,
                (purchase_id, current_user["id"])
            )

            if cursor.fetchone() is None:
                raise HTTPException(
                    status_code=404,
                    detail="Purchase not found."
                )

    # Read the uploaded file
    content = await file.read(MAX_FILE_SIZE + 1)

    # Validate file size and content type
    validate_upload(file, content)

    if evidence_type == "item_photo" and file.content_type == "application/pdf":
        raise HTTPException(
            status_code=400,
            detail="Item photos must be images."
        )    

    # Generate a unique filename
    extension = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "application/pdf": ".pdf",
    }[file.content_type]

    stored_filename = f"{uuid4()}{extension}"

    # Create the full storage path
    file_path = UPLOAD_DIR / stored_filename

    # Save the file locally
    file_path.write_bytes(content)    


    try:
        with get_connection() as conn:
            with conn.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    """
                    INSERT INTO purchase_evidence (
                        purchase_request_id,
                        evidence_type,
                        file_name,
                        storage_key,
                        content_type
                    )
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING *
                    """,
                    (
                        purchase_id,
                        evidence_type,
                        file.filename or "unnamed",
                        stored_filename,
                        file.content_type
                    )
                )

                saved_evidence = cursor.fetchone()

    except Exception:
        file_path.unlink(missing_ok=True)
        raise

    return saved_evidence


@router.get("/{purchase_id}/evidence")
def list_purchase_evidence(
    purchase_id: UUID,
    current_user: dict = Depends(require_password_changed)
):
    if current_user["role"] not in ("admin", "manager"):
        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                """
                SELECT id
                FROM purchase_requests
                WHERE id = %s
                """,
                (purchase_id,)
            )

            if cursor.fetchone() is None:
                raise HTTPException(
                    status_code=404,
                    detail="Purchase not found."
                )

            cursor.execute(
                """
                SELECT
                    id,
                    evidence_type,
                    file_name,
                    content_type
                FROM purchase_evidence
                WHERE purchase_request_id = %s
                ORDER BY id
                """,
                (purchase_id,)
            )

            evidence = cursor.fetchall()

    return evidence



@router.get("/{purchase_id}/evidence/{evidence_id}/file")
def get_purchase_evidence_file(
    purchase_id: UUID,
    evidence_id: UUID,
    current_user: dict = Depends(require_password_changed)
):
    # Only admins and managers can inspect evidence here.
    if current_user["role"] not in ("admin", "manager"):
        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                """
                SELECT
                    e.storage_key,
                    e.content_type,
                    e.file_name
                FROM purchase_evidence e
                JOIN purchase_requests p
                    ON p.id = e.purchase_request_id
                WHERE e.id = %s
                  AND p.id = %s
                """,
                (evidence_id, purchase_id)
            )

            evidence = cursor.fetchone()

    if evidence is None:
        raise HTTPException(
            status_code=404,
            detail="Evidence not found."
        )

    # Only use the filename, never a client-provided path.
    storage_key = evidence["storage_key"]
    file_path = UPLOAD_DIR / storage_key

    if (
        Path(storage_key).name != storage_key
        or not file_path.is_file()
    ):
        raise HTTPException(
            status_code=404,
            detail="Evidence file not found."
        )

    return FileResponse(
        path=file_path,
        media_type=evidence["content_type"],
        headers={
            "Content-Disposition": "inline",
            "X-Content-Type-Options": "nosniff"
        }
    )



@router.post("/{purchase_id}/review-notes", status_code=201)
def create_review_note(
    purchase_id: UUID,
    note: ReviewNoteCreate,
    current_user: dict = Depends(require_password_changed)
):
    # Only admins and managers can add investigation notes.
    if current_user["role"] not in ("admin", "manager"):
        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )

    content = note.content.strip()

    if not content:
        raise HTTPException(
            status_code=422,
            detail="Note cannot be empty."
        )

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cursor:

            # Verify that the purchase exists.
            cursor.execute(
                """
                SELECT id
                FROM purchase_requests
                WHERE id = %s
                """,
                (purchase_id,)
            )

            if cursor.fetchone() is None:
                raise HTTPException(
                    status_code=404,
                    detail="Purchase not found."
                )

            # Save the investigation note.
            cursor.execute(
                """
                INSERT INTO purchase_review_notes (
                    purchase_request_id,
                    author_id,
                    content
                )
                VALUES (%s, %s, %s)
                RETURNING *
                """,
                (
                    purchase_id,
                    current_user["id"],
                    content
                )
            )

            saved_note = cursor.fetchone()

    return saved_note


@router.get("/{purchase_id}/review-notes")
def list_review_notes(
    purchase_id: UUID,
    current_user: dict = Depends(require_password_changed)
):
    if current_user["role"] not in ("admin", "manager"):
        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cursor:

            cursor.execute(
                """
                SELECT id
                FROM purchase_requests
                WHERE id = %s
                """,
                (purchase_id,)
            )

            if cursor.fetchone() is None:
                raise HTTPException(
                    status_code=404,
                    detail="Purchase not found."
                )

            cursor.execute(
                """
                SELECT
                    n.id,
                    n.purchase_request_id,
                    n.author_id,
                    u.name AS author_name,
                    n.content,
                    n.created_at
                FROM purchase_review_notes n
                JOIN users u ON u.id = n.author_id
                WHERE n.purchase_request_id = %s
                ORDER BY n.created_at ASC, n.id ASC
                """,
                (purchase_id,)
            )

            notes = cursor.fetchall()

    return notes




@router.patch("/{purchase_id}/review-status")
def update_review_status(
    purchase_id: UUID,
    update: ReviewStatusUpdate,
    current_user: dict = Depends(require_password_changed)
):
    # Only admins and managers can change review statuses.
    if current_user["role"] not in ("admin", "manager"):
        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )

    reason = update.reason.strip()

    if not reason:
        raise HTTPException(
            status_code=422,
            detail="A reason is required."
        )

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cursor:

            # Find and lock the purchase while updating it.
            cursor.execute(
                """
                SELECT id, review_status
                FROM purchase_requests
                WHERE id = %s
                FOR UPDATE
                """,
                (purchase_id,)
            )

            purchase = cursor.fetchone()

            if purchase is None:
                raise HTTPException(
                    status_code=404,
                    detail="Purchase not found."
                )

            old_status = purchase["review_status"]
            new_status = update.review_status

            if old_status == new_status:
                raise HTTPException(
                    status_code=409,
                    detail="Purchase already has this review status."
                )

            # Update the current review status.
            cursor.execute(
                """
                UPDATE purchase_requests
                SET review_status = %s,
                    updated_at = NOW()
                WHERE id = %s
                RETURNING *
                """,
                (new_status, purchase_id)
            )

            updated_purchase = cursor.fetchone()

            # Record the change in our history table.
            cursor.execute(
                """
                INSERT INTO purchase_review_history (
                    purchase_request_id,
                    changed_by,
                    old_status,
                    new_status,
                    reason
                )
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    purchase_id,
                    current_user["id"],
                    old_status,
                    new_status,
                    reason
                )
            )

    return updated_purchase

@router.get("/{purchase_id}/review-history")
def list_review_history(
    purchase_id: UUID,
    current_user: dict = Depends(require_password_changed)
):
    # Only admins and managers can view review history.
    if current_user["role"] not in ("admin", "manager"):
        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cursor:

            # Verify that the purchase exists.
            cursor.execute(
                """
                SELECT id
                FROM purchase_requests
                WHERE id = %s
                """,
                (purchase_id,)
            )

            if cursor.fetchone() is None:
                raise HTTPException(
                    status_code=404,
                    detail="Purchase not found."
                )

            # Retrieve all recorded review status changes.
            cursor.execute(
                """
                SELECT
                    h.id,
                    h.old_status,
                    h.new_status,
                    h.reason,
                    h.changed_at,
                    u.name AS changed_by_name
                FROM purchase_review_history h
                JOIN users u ON h.changed_by = u.id
                WHERE h.purchase_request_id = %s
                ORDER BY h.changed_at DESC, h.id DESC
                """,
                (purchase_id,)
            )

            history = cursor.fetchall()

    return history


@router.patch("/{purchase_id}/accounting-checks/{check_type}")
def update_accounting_check(
    purchase_id: UUID,
    check_type: Literal["receipt", "item_photo", "bank_match"],
    data: AccountingCheckUpdate,
    current_user: dict = Depends(
        require_password_changed
    )
):
    if current_user["role"] not in ("admin", "manager"):
        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )

    reason = data.reason.strip()

    if not reason:
        raise HTTPException(
            status_code=422,
            detail="A reason is required."
        )    

    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, status, accounting_status
                FROM purchase_requests
                WHERE id = %s
                FOR UPDATE
                """,
                (purchase_id,)
            )

            purchase = cursor.fetchone()

            if purchase is None:
                raise HTTPException(
                    status_code=404,
                    detail="Purchase not found."
                )

            purchase_id_db, purchase_status, accounting_status = purchase

            if purchase_status != "purchased":
                raise HTTPException(
                    status_code=400,
                    detail="Only completed purchases can be verified."
                )
            # Retrieve the accounting check for this purchase
            cursor.execute(
                """
                SELECT id, status
                FROM purchase_accounting_checks
                WHERE purchase_request_id = %s
                AND check_type = %s
                FOR UPDATE
                """,
                (purchase_id, check_type)
            )

            accounting_check = cursor.fetchone()

            if accounting_check is None:
                raise HTTPException(
                    status_code=404,
                    detail="Accounting check not found."
                )

            check_id, current_check_status = accounting_check

            old_status = current_check_status
            new_status = data.status

            if old_status == new_status:
                raise HTTPException(
                    status_code=400,
                    detail="Accounting check already has this status."
                )

            cursor.execute(
                """
                UPDATE purchase_accounting_checks
                SET status = %s,
                    verified_by = CASE
                        WHEN %s = 'pending' THEN NULL
                        ELSE %s::uuid
                    END,
                    verified_at = CASE
                        WHEN %s = 'pending' THEN NULL
                        ELSE NOW()
                    END,
                    notes = %s,
                    updated_at = NOW()
                WHERE id = %s
                """,
                (
                    new_status,
                    new_status,
                    current_user["id"],
                    new_status,
                    reason,
                    check_id
                )
            )

            # Record the accounting status change in the audit history
            cursor.execute(
                """
                INSERT INTO purchase_accounting_history (
                    purchase_request_id,
                    accounting_check_id,
                    old_status,
                    new_status,
                    changed_by,
                    reason
                )
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    purchase_id,
                    check_id,
                    old_status,
                    new_status,
                    current_user["id"],
                    reason
                )
            )
            # Retrieve all accounting checks for this purchase
            cursor.execute(
                """
                SELECT check_type, status
                FROM purchase_accounting_checks
                WHERE purchase_request_id = %s
                """,
                (purchase_id,)
            )

            checks = cursor.fetchall()

            # Convert the results into a dictionary
            check_statuses = {
                check_type: status
                for check_type, status in checks
            }

            # Make sure all three required accounting checks exist
            required_checks = {"receipt", "item_photo", "bank_match"}

            if set(check_statuses.keys()) != required_checks:
                raise HTTPException(
                    status_code=500,
                    detail="Purchase is missing required accounting checks."
                )

            # Calculate the overall accounting status
            statuses = list(check_statuses.values())

            if "failed" in statuses:
                new_accounting_status = "exception"

            elif all(status == "passed" for status in statuses):
                new_accounting_status = "verified"

            elif "passed" in statuses:
                new_accounting_status = "partially_verified"

            else:
                new_accounting_status = "unverified"

            # Save the overall accounting status
            cursor.execute(
                """
                UPDATE purchase_requests
                SET accounting_status = %s
                WHERE id = %s
                """,
                (
                    new_accounting_status,
                    purchase_id
                )
            )
    return {
        "message": "Accounting check updated successfully.",
        "purchase_id": str(purchase_id),
        "check_id": str(check_id),
        "check_type": check_type,
        "old_check_status": old_status,
        "new_check_status": new_status,
        "accounting_status": new_accounting_status
    }


@router.get("/{purchase_id}/accounting-checks")
def get_accounting_checks(
    purchase_id: UUID,
    current_user: dict = Depends(require_password_changed)
):
    if current_user["role"] not in ("admin", "manager"):
        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )

    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, status, accounting_status
                FROM purchase_requests
                WHERE id = %s
                """,
                (purchase_id,)
            )

            purchase = cursor.fetchone()

            if purchase is None:
                raise HTTPException(
                    status_code=404,
                    detail="Purchase not found."
                )

            purchase_id_db, purchase_status, accounting_status = purchase

            cursor.execute(
                """
                SELECT
                    check_type,
                    status,
                    verified_by,
                    verified_at,
                    notes
                FROM purchase_accounting_checks
                WHERE purchase_request_id = %s
                ORDER BY check_type
                """,
                (purchase_id,)
            )

            checks = cursor.fetchall()

    return {
        "purchase_id": str(purchase_id),
        "purchase_status": purchase_status,
        "accounting_status": accounting_status,
        "checks": [
            {
                "check_type": check_type,
                "status": status,
                "verified_by": str(verified_by) if verified_by else None,
                "verified_at": verified_at,
                "notes": notes
            }
            for check_type, status, verified_by, verified_at, notes in checks
        ]
    }

@router.get("/{purchase_id}/accounting-history")
def get_accounting_history(
    purchase_id: UUID,
    current_user: dict = Depends(require_password_changed)
):
    if current_user["role"] not in ("admin", "manager"):
        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cursor:

            # Verify the purchase exists
            cursor.execute(
                """
                SELECT id
                FROM purchase_requests
                WHERE id = %s
                """,
                (purchase_id,)
            )

            if cursor.fetchone() is None:
                raise HTTPException(
                    status_code=404,
                    detail="Purchase not found."
                )
            # Retrieve the accounting verification history
            cursor.execute(
                """
                SELECT
                    h.id,
                    c.check_type,
                    h.old_status,
                    h.new_status,
                    h.reason,
                    h.created_at,
                    u.name AS changed_by_name
                FROM purchase_accounting_history h
                JOIN purchase_accounting_checks c
                    ON h.accounting_check_id = c.id
                JOIN users u
                    ON h.changed_by = u.id
                WHERE h.purchase_request_id = %s
                ORDER BY h.created_at DESC, h.id DESC
                """,
                (purchase_id,)
            )

            history = cursor.fetchall()

    return history
    