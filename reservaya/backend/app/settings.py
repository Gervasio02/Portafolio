import os
from dataclasses import dataclass


def normalise_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


@dataclass(frozen=True)
class Settings:
    database_url: str
    jwt_secret: str
    secure_cookies: bool

    @classmethod
    def load(cls) -> "Settings":
        return cls(
            database_url=normalise_database_url(os.environ["DATABASE_URL"]),
            jwt_secret=os.environ["JWT_SECRET"],
            secure_cookies=os.getenv("COOKIE_SECURE", "true").lower() == "true",
        )
