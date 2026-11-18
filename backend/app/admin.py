from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator

from app.permissions import require_role

from app.security import hash_password

from fastapi import HTTPException
from app.database import get_connection
from psycopg.errors import UniqueViolation

from psycopg.rows import dict_row

import secrets
import string

from uuid import UUID


router = APIRouter(
    prefix="/admin",
    tags=["Administration"]
)


def generate_temporary_password(length: int = 20) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(
        secrets.choice(alphabet)
        for _ in range(length)
    )

class CreateUserRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=254)
    role: Literal["employee", "manager"]
    #temporary_password: str = Field(min_length=12, max_length=128)


    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Name cannot be empty")

        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip().lower()

        if "@" not in value:
            raise ValueError("Invalid email address")

        local, domain = value.rsplit("@", 1)

        if not local or "." not in domain:
            raise ValueError("Invalid email address")

        return value


@router.post("/users", status_code=201)
def create_user(
    request: CreateUserRequest,
    current_user: dict = Depends(require_role("admin"))
):
    #password_hash = hash_password(request.temporary_password)
    temporary_password = generate_temporary_password()
    password_hash = hash_password(temporary_password)

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO users (
                        name,
                        email,
                        password_hash,
                        role,
                        is_active,
                        must_change_password
                    )
                    VALUES (%s, %s, %s, %s, TRUE, TRUE)
                    RETURNING id
                    """,
                    (
                        request.name,
                        request.email,
                        password_hash,
                        request.role
                    )
                )

                user_id = cur.fetchone()[0]

    except UniqueViolation:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists"
        )

    return {
        "message": "Employee account created successfully",
        "user_id": str(user_id),
        "name": request.name,
        "email": request.email,
        "role": request.role,
        "temporary_password": temporary_password,
        "must_change_password": True
    }


@router.get("/users")
def list_users(
    current_user: dict = Depends(require_role("admin", "manager"))
):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    name,
                    email,
                    role,
                    is_active
                FROM users
                ORDER BY name ASC
                """
            )

            rows = cur.fetchall()

    return [
        {
            "id": str(row[0]),
            "name": row[1],
            "email": row[2],
            "role": row[3],
            "is_active": row[4]
        }
        for row in rows
    ]



@router.get("/users/{user_id}")
def get_user_profile(
    user_id: UUID,
    current_user: dict = Depends(require_role("admin", "manager"))
):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    name,
                    email,
                    role,
                    is_active
                FROM users
                WHERE id = %s
                """,
                (user_id,)
            )

            employee = cur.fetchone()

    if employee is None:
        raise HTTPException(
            status_code=404,
            detail="Employee not found"
        )

    return {
        "id": str(employee[0]),
        "name": employee[1],
        "email": employee[2],
        "role": employee[3],
        "is_active": employee[4]
    }


@router.patch("/users/{user_id}/deactivate")
def deactivate_user(
    user_id: str,
    current_user: dict = Depends(require_role("admin"))
):
    # Prevent the Admin from deactivating their own account
    if user_id == current_user["id"]:
        raise HTTPException(
            status_code=400,
            detail="You cannot deactivate your own account"
        )

    with get_connection() as conn:
        with conn.cursor() as cur:

            # Lock the employee record while updating it
            cur.execute(
                """
                SELECT id, role, is_active
                FROM users
                WHERE id = %s
                FOR UPDATE
                """,
                (user_id,)
            )

            employee = cur.fetchone()

            if employee is None:
                raise HTTPException(
                    status_code=404,
                    detail="Employee not found"
                )

            employee_id, role, is_active = employee

            # Protect Admin accounts
            if role == "admin":
                raise HTTPException(
                    status_code=403,
                    detail="Admin accounts cannot be deactivated"
                )

            if not is_active:
                raise HTTPException(
                    status_code=400,
                    detail="Employee is already inactive"
                )

            # Deactivate the account
            cur.execute(
                """
                UPDATE users
                SET is_active = FALSE
                WHERE id = %s
                """,
                (employee_id,)
            )

            # Revoke all existing sessions
            cur.execute(
                """
                UPDATE sessions
                SET revoked_at = NOW()
                WHERE user_id = %s
                  AND revoked_at IS NULL
                """,
                (employee_id,)
            )

    return {
        "message": "Employee deactivated successfully",
        "user_id": str(employee_id),
        "is_active": False
    }


@router.patch("/users/{user_id}/reactivate")
def reactivate_user(
    user_id: str,
    current_user: dict = Depends(require_role("admin"))
):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, role, is_active
                FROM users
                WHERE id = %s
                FOR UPDATE
                """,
                (user_id,)
            )

            employee = cur.fetchone()

            if employee is None:
                raise HTTPException(
                    status_code=404,
                    detail="Employee not found"
                )

            employee_id, role, is_active = employee

            if role == "admin":
                raise HTTPException(
                    status_code=403,
                    detail="Admin accounts cannot be modified here"
                )

            if is_active:
                raise HTTPException(
                    status_code=400,
                    detail="Employee is already active"
                )

            cur.execute(
                """
                UPDATE users
                SET is_active = TRUE
                WHERE id = %s
                """,
                (employee_id,)
            )

    return {
        "message": "Employee reactivated successfully",
        "user_id": str(employee_id),
        "is_active": True
    }


@router.get("/users/{user_id}/purchases")
def get_employee_purchases(
    user_id: UUID,
    current_user: dict = Depends(require_role("admin", "manager"))
):
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:

            # Verify the employee exists
            cur.execute(
                """
                SELECT id
                FROM users
                WHERE id = %s
                """,
                (user_id,)
            )

            if cur.fetchone() is None:
                raise HTTPException(
                    status_code=404,
                    detail="Employee not found"
                )

            # Retrieve purchases belonging to this employee
            cur.execute(
                """
                SELECT
                    id,
                    job_name,
                    item_description,
                    amount,
                    status,
                    review_status,
                    after_the_fact,
                    created_at
                FROM purchase_requests
                WHERE user_id = %s
                ORDER BY created_at DESC
                """,
                (user_id,)
            )

            purchases = cur.fetchall()

    return purchases



@router.get("/users/{user_id}/statistics")
def get_employee_statistics(
    user_id: UUID,
    current_user: dict = Depends(require_role("admin", "manager"))
):
    with get_connection() as conn:
        with conn.cursor() as cur:
            # First, verify that the employee exists.
            cur.execute(
                """
                SELECT id
                FROM users
                WHERE id = %s
                """,
                (user_id,)
            )

            if cur.fetchone() is None:
                raise HTTPException(
                    status_code=404,
                    detail="Employee not found"
                )

            # Calculate spending and investigation statistics.
            cur.execute(
                """
                SELECT
                    COUNT(id) FILTER (
                        WHERE status = 'purchased'
                    ) AS total_purchases,

                    COALESCE(
                        SUM(amount) FILTER (
                            WHERE status = 'purchased'
                        ),
                        0
                    ) AS total_spent,

                    COUNT(id) FILTER (
                        WHERE review_status IN ('pending', 'in_progress')
                    ) AS active_investigations

                FROM purchase_requests
                WHERE user_id = %s
                """,
                (user_id,)
            )

            stats = cur.fetchone()

    return {
        "total_purchases": stats[0],
        "total_spent": float(stats[1]),
        "active_investigations": stats[2]
    }
