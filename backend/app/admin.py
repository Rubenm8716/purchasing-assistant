from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator

from app.permissions import require_role

from app.security import hash_password

from fastapi import HTTPException
from app.database import get_connection
from psycopg.errors import UniqueViolation


router = APIRouter(
    prefix="/admin",
    tags=["Administration"]
)


class CreateUserRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=254)
    role: Literal["employee", "manager"]
    temporary_password: str = Field(min_length=12, max_length=128)

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
    password_hash = hash_password(request.temporary_password)

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
        "must_change_password": True
    }
