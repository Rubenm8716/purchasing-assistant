
import secrets
import hashlib
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Response, Request, Depends
from pydantic import BaseModel, Field

from app.database import get_connection
from app.security import verify_password, hash_password


router = APIRouter(prefix="/auth", tags=["Authentication"])

SESSION_DURATION_DAYS = 7
COOKIE_NAME = "session_token"

class LoginRequest(BaseModel):
    email: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=12, max_length=128)



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

# Remove endpoint so we can use get_current function elsewhere
#@router.get("/me")
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

@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    return user

# Log out process
@router.post("/logout")
def logout(request: Request, response: Response):
    session_token = request.cookies.get(COOKIE_NAME)

    if session_token:
        token_hash = hashlib.sha256(
            session_token.encode("utf-8")
        ).hexdigest()

        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE sessions
                    SET revoked_at = NOW()
                    WHERE token_hash = %s
                      AND revoked_at IS NULL
                    """,
                    (token_hash,)
                )

    response.delete_cookie(
        key=COOKIE_NAME,
        path="/"
    )

    return {
        "message": "Logged out successfully"
    }



@router.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["id"]

    # 1. Retrieve the user's existing password hash
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT password_hash
                FROM users
                WHERE id = %s
                FOR UPDATE
                """,
                (user_id,)
            )

            result = cur.fetchone()

            if result is None:
                raise HTTPException(
                    status_code=404,
                    detail="User not found"
                )

            stored_hash = result[0]

            # 2. Verify their current password
            if not verify_password(
                data.current_password,
                stored_hash
            ):
                raise HTTPException(
                    status_code=400,
                    detail="Current password is incorrect"
                )

            # 3. Prevent reusing the same password
            if data.current_password == data.new_password:
                raise HTTPException(
                    status_code=400,
                    detail="New password must be different"
                )

            # 4. Hash the new password
            new_hash = hash_password(data.new_password)

            # 5. Update PostgreSQL
            cur.execute(
                """
                UPDATE users
                SET password_hash = %s,
                    must_change_password = FALSE
                WHERE id = %s
                """,
                (new_hash, user_id)
            )

            # 6. Identify the current session
            session_token = request.cookies.get(COOKIE_NAME)

            current_token_hash = hashlib.sha256(
                session_token.encode("utf-8")
            ).hexdigest()

            # 7. Revoke all other active sessions
            cur.execute(
                """
                UPDATE sessions
                SET revoked_at = NOW()
                WHERE user_id = %s
                AND revoked_at IS NULL
                AND token_hash <> %s
                """,
                (user_id, current_token_hash)
            )

    return {
        "message": "Password changed successfully",
        "must_change_password": False
    }


#{
#  "email": "manager1@example.com",
#  "password": "ManagerDemo123!"
#  "new password": "Lovecookies@8716"
#}



#{
#  "current_password": "Lovecookies@8716",
#  "new_password": "Lovecookies@716"
#}

#employee1@example.com
#DemoPassword123! -> Lovecookies@8716