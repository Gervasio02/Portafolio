from datetime import timedelta

import jwt
from fastapi import HTTPException, Request, Response
from pwdlib import PasswordHash

from .time_slots import now_utc

COOKIE = "reservaya_session"
SESSION_SECONDS = 60 * 60 * 4
passwords = PasswordHash.recommended()
DUMMY_HASH = passwords.hash("dummy-time-only")


def set_session(response: Response, secret: str, user_id: int, secure: bool) -> None:
    token = jwt.encode(
        {
            "sub": str(user_id),
            "exp": now_utc() + timedelta(seconds=SESSION_SECONDS),
            "iss": "reservaya",
            "aud": "reservaya-client",
        },
        secret,
        algorithm="HS256",
    )
    response.set_cookie(
        COOKIE, token, max_age=SESSION_SECONDS, path="/api", httponly=True, secure=secure, samesite="strict"
    )


def session_id(request: Request, secret: str) -> int:
    token = request.cookies.get(COOKIE)
    if token:
        try:
            payload = jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                issuer="reservaya",
                audience="reservaya-client",
                options={"require": ["exp", "sub"]},
            )
            return int(payload["sub"])
        except (jwt.InvalidTokenError, ValueError):
            pass
    raise HTTPException(401, "Inicia sesión para continuar.")
