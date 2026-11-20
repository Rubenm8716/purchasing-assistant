from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Literal

from app.database import get_connection
from app.permissions import require_password_changed

from uuid import UUID

router = APIRouter(
    prefix="/conversations",
    tags=["Conversations"]
)


class CreateConversationRequest(BaseModel):
    mode: Literal["general", "purchase"]
    message: str = Field(min_length=1, max_length=10000)


@router.post("", status_code=201)
def create_conversation(
    data: CreateConversationRequest,
    current_user: dict = Depends(require_password_changed)
):
    user_id = current_user["id"]
    content = data.message.strip()

    if not content:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=422,
            detail="Message cannot be empty"
        )

    title = content[:100]

    with get_connection() as conn:
        with conn.cursor() as cur:

            # Create the conversation
            cur.execute(
                """
                INSERT INTO conversations (
                    user_id,
                    title,
                    title_source,
                    mode
                )
                VALUES (%s, %s, %s, %s)
                RETURNING id
                """,
                (
                    user_id,
                    title,
                    "default",
                    data.mode
                )
            )

            conversation_id = cur.fetchone()[0]

            # Save the first message
            cur.execute(
                """
                INSERT INTO messages (
                    conversation_id,
                    role,
                    content
                )
                VALUES (%s, %s, %s)
                RETURNING id
                """,
                (
                    conversation_id,
                    "user",
                    content
                )
            )

            message_id = cur.fetchone()[0]

    return {
        "conversation_id": str(conversation_id),
        "message_id": str(message_id),
        "mode": data.mode,
        "title": title,
        "message": content
    }

class AddMessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=10000)

class RenameConversationRequest(BaseModel):
    title: str = Field(min_length=1, max_length=100)


def save_assistant_message(
    conversation_id: UUID,
    content: str,
    user_id: str
):
    content = content.strip()

    if not content:
        raise ValueError("Assistant message cannot be empty")

    with get_connection() as conn:
        with conn.cursor() as cur:

            # Ensure the conversation exists and is active
            cur.execute(
                """
                SELECT id
                FROM conversations
                WHERE id = %s
                  AND user_id = %s
                  AND archived_at IS NULL
                FOR UPDATE
                """,
                (conversation_id, user_id)
            )

            if cur.fetchone() is None:
                raise ValueError("Active conversation not found")

            # Save the assistant's response
            cur.execute(
                """
                INSERT INTO messages (
                    conversation_id,
                    role,
                    content
                )
                VALUES (%s, 'assistant', %s)
                RETURNING id
                """,
                (conversation_id, content)
            )

            message_id = cur.fetchone()[0]

            # Update conversation activity
            cur.execute(
                """
                UPDATE conversations
                SET updated_at = NOW()
                WHERE id = %s
                """,
                (conversation_id,)
            )

    return str(message_id)


@router.post("/{conversation_id}/messages", status_code=201)
def add_message(
    conversation_id: UUID,
    data: AddMessageRequest,
    current_user: dict = Depends(require_password_changed)
):
    content = data.message.strip()

    if not content:
        raise HTTPException(
            status_code=422,
            detail="Message cannot be empty"
        )

    with get_connection() as conn:
        with conn.cursor() as cur:

            # Verify this conversation belongs to the logged-in user
            cur.execute(
                """
                SELECT id
                FROM conversations
                WHERE id = %s
                  AND user_id = %s
                  AND archived_at IS NULL
                FOR UPDATE
                """,
                (conversation_id, current_user["id"])
            )

            conversation = cur.fetchone()

            if conversation is None:
                raise HTTPException(
                    status_code=404,
                    detail="Conversation not found"
                )

            # Save the new message
            cur.execute(
                """
                INSERT INTO messages (
                    conversation_id,
                    role,
                    content
                )
                VALUES (%s, 'user', %s)
                RETURNING id
                """,
                (conversation_id, content)
            )

            message_id = cur.fetchone()[0]

            # Update the conversation's activity timestamp
            cur.execute(
                """
                UPDATE conversations
                SET updated_at = NOW()
                WHERE id = %s
                """,
                (conversation_id,)
            )

    return {
        "conversation_id": conversation_id,
        "message_id": str(message_id),
        "message": content
    }


@router.get("/{conversation_id}")
def get_conversation(
    conversation_id: UUID,
    current_user: dict = Depends(require_password_changed)
):
    with get_connection() as conn:
        with conn.cursor() as cur:

            # Retrieve the conversation, but only if it belongs
            # to the authenticated employee.
            cur.execute(
                """
                SELECT id, title, mode, created_at,
                       updated_at, archived_at
                FROM conversations
                WHERE id = %s
                  AND user_id = %s
                  AND archived_at IS NULL
                """,
                (conversation_id, current_user["id"])
            )

            conversation = cur.fetchone()

            if conversation is None:
                raise HTTPException(
                    status_code=404,
                    detail="Conversation not found"
                )

            # Retrieve all messages in chronological order.
            cur.execute(
                """
                SELECT id, role, content, created_at
                FROM messages
                WHERE conversation_id = %s
                ORDER BY created_at ASC, id ASC
                """,
                (conversation_id,)
            )

            messages = cur.fetchall()

    return {
        "id": str(conversation[0]),
        "title": conversation[1],
        "mode": conversation[2],
        "created_at": conversation[3],
        "updated_at": conversation[4],
        "archived_at": conversation[5],
        "messages": [
            {
                "id": str(message[0]),
                "role": message[1],
                "content": message[2],
                "created_at": message[3]
            }
            for message in messages
        ]
    }

@router.get("")
def list_conversations(
    current_user: dict = Depends(require_password_changed)
):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, title, mode, created_at, updated_at
                FROM conversations
                WHERE user_id = %s
                  AND archived_at IS NULL
                ORDER BY updated_at DESC, id DESC
                """,
                (current_user["id"],)
            )

            conversations = cur.fetchall()

    return {
        "conversations": [
            {
                "id": str(conversation[0]),
                "title": conversation[1],
                "mode": conversation[2],
                "created_at": conversation[3],
                "updated_at": conversation[4]
            }
            for conversation in conversations
        ]
    }

@router.patch("/{conversation_id}/archive")
def archive_conversation(
    conversation_id: UUID,
    current_user: dict = Depends(require_password_changed)
):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE conversations
                SET archived_at = NOW(),
                    updated_at = NOW()
                WHERE id = %s
                  AND user_id = %s
                  AND archived_at IS NULL
                RETURNING id, archived_at
                """,
                (conversation_id, current_user["id"])
            )

            result = cur.fetchone()

            if result is None:
                raise HTTPException(
                    status_code=404,
                    detail="Active conversation not found"
                )

    return {
        "conversation_id": str(result[0]),
        "archived_at": result[1],
        "message": "Conversation archived successfully"
    }

@router.patch("/{conversation_id}/rename")
def rename_conversation(
    conversation_id: UUID,
    data: RenameConversationRequest,
    current_user: dict = Depends(require_password_changed)
):
    title = data.title.strip()

    if not title:
        raise HTTPException(
            status_code=422,
            detail="Title cannot be empty"
        )

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE conversations
                SET title = %s,
                    title_source = 'manual',
                    updated_at = NOW()
                WHERE id = %s
                  AND user_id = %s
                  AND archived_at IS NULL
                RETURNING id, title
                """,
                (
                    title,
                    conversation_id,
                    current_user["id"]
                )
            )

            result = cur.fetchone()

            if result is None:
                raise HTTPException(
                    status_code=404,
                    detail="Active conversation not found"
                )

    return {
        "conversation_id": str(result[0]),
        "title": result[1],
        "message": "Conversation renamed successfully"
    }