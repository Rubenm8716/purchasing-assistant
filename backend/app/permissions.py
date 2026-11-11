from fastapi import Depends, HTTPException

from app.auth import get_current_user


def require_role(*allowed_roles: str):

    def check_role(
        user: dict = Depends(get_current_user)
    ):
        if user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to access this resource"
            )

        return user

    return check_role

def require_password_changed(
    user: dict = Depends(get_current_user)
):
    if user["must_change_password"]:
        raise HTTPException(
            status_code=403,
            detail="You must change your password before continuing"
        )

    return user