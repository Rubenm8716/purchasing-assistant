
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
                    status
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                    purchase.after_the_fact,
                    "purchased" if purchase.after_the_fact else "requested"
                )
            )

            saved_purchase = cursor.fetchone()

    return saved_purchase



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
