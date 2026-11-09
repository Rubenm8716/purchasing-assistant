
import secrets
import hashlib
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Response, Request
from pydantic import BaseModel

from app.database import get_connection
from app.security import verify_password


router = APIRouter(prefix="/auth", tags=["Authentication"])

SESSION_DURATION_DAYS = 7
COOKIE_NAME = "session_token"

class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
def login(data: LoginRequest, response: Response):
    email = data.email.strip().lower()

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, email, password_hash,
                       role, is_active, must_change_password
                FROM users
                WHERE email = %s
                """,
                (email,)
            )

            user = cur.fetchone()

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    (
        user_id,
        name,
        email,
        stored_hash,
        role,
        is_active,
        must_change_password
    ) = user

    if not verify_password(data.password, stored_hash):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not is_active:
        raise HTTPException(
            status_code=403,
            detail="Account is inactive"
        )
    session_token = secrets.token_urlsafe(32)

    token_hash = hashlib.sha256(
        session_token.encode("utf-8")
    ).hexdigest()

    expires_at = datetime.now(timezone.utc) + timedelta(
        days=SESSION_DURATION_DAYS
    )    

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO sessions (user_id, token_hash, expires_at)
                VALUES (%s, %s, %s)
                """,
                (user_id, token_hash, expires_at)
            )

    response.set_cookie(
        key=COOKIE_NAME,
        value=session_token,
        httponly=True,
        secure=False,  # Local development over HTTP only
        samesite="lax",
        max_age=SESSION_DURATION_DAYS * 24 * 60 * 60,
        path="/"
    )    

    return {
        "message": "Credentials verified",
        "user": {
            "id": str(user_id),
            "name": name,
            "email": email,
            "role": role,
            "must_change_password": must_change_password
        }
    }

#@router.get("/me")
#def get_current_user(request: Request):
#    session_token = request.cookies.get(COOKIE_NAME)
#
#    if not session_token:
#        raise HTTPException(
#            status_code=401,
#            detail="Not authenticated"
#        )
#
#    return {
#        "message": "Session cookie received"
#    }


@router.get("/me")
def get_current_user(request: Request):
    session_token = request.cookies.get(COOKIE_NAME)

    if not session_token:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated"
        )

    token_hash = hashlib.sha256(
        session_token.encode("utf-8")
    ).hexdigest()

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT u.id, u.name, u.email, u.role,
                       u.must_change_password
                FROM sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.token_hash = %s
                  AND s.expires_at > NOW()
                  AND s.revoked_at IS NULL
                  AND u.is_active = TRUE
                """,
                (token_hash,)
            )

            user = cur.fetchone()

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired session"
        )

    user_id, name, email, role, must_change_password = user

    return {
        "id": str(user_id),
        "name": name,
        "email": email,
        "role": role,
        "must_change_password": must_change_password
    }

