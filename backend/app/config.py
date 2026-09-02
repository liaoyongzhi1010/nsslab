from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env", override=False)


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class LLMSettings:
    provider: str
    provider_name: str
    base_url: str
    model: str
    api_key: str
    timeout_seconds: float
    temperature: float
    max_tokens: int
    fallback_to_local: bool

    @property
    def remote_configured(self) -> bool:
        return self.provider == "openai_compatible" and bool(self.api_key and self.base_url and self.model)

    @classmethod
    def from_env(cls) -> "LLMSettings":
        return cls(
            provider=os.getenv("LLM_PROVIDER", "local").strip().lower(),
            provider_name=os.getenv("LLM_PROVIDER_NAME", "OpenAI Compatible").strip(),
            base_url=os.getenv("LLM_BASE_URL", "").strip().rstrip("/"),
            model=os.getenv("LLM_MODEL", "").strip(),
            api_key=os.getenv("LLM_API_KEY", "").strip(),
            timeout_seconds=float(os.getenv("LLM_TIMEOUT_SECONDS", "60")),
            temperature=float(os.getenv("LLM_TEMPERATURE", "0.2")),
            max_tokens=int(os.getenv("LLM_MAX_TOKENS", "1800")),
            fallback_to_local=_as_bool(os.getenv("LLM_FALLBACK_TO_LOCAL"), True),
        )


@dataclass(frozen=True)
class AppSettings:
    environment: str
    database_url: str
    database_auto_create: bool
    upload_dir: Path
    registration_enabled: bool
    session_ttl_hours: int
    session_cookie_secure: bool
    admin_username: str
    admin_password: str
    admin_display_name: str
    student_username: str
    student_password: str
    student_display_name: str

    @classmethod
    def from_env(cls) -> "AppSettings":
        return cls(
            environment=os.getenv("APP_ENV", "development").strip().lower(),
            database_url=os.getenv("DATABASE_URL", "postgresql+psycopg://cryptolab:cryptolab@127.0.0.1:5432/cryptolab").strip(),
            database_auto_create=_as_bool(os.getenv("DATABASE_AUTO_CREATE"), False),
            upload_dir=Path(os.getenv("UPLOAD_DIR", str(BACKEND_DIR / "uploads"))).expanduser().resolve(),
            registration_enabled=_as_bool(os.getenv("REGISTRATION_ENABLED"), True),
            session_ttl_hours=int(os.getenv("SESSION_TTL_HOURS", "12")),
            session_cookie_secure=_as_bool(os.getenv("SESSION_COOKIE_SECURE"), False),
            admin_username=os.getenv("AUTH_ADMIN_USERNAME", "").strip().lower(),
            admin_password=os.getenv("AUTH_ADMIN_PASSWORD", ""),
            admin_display_name=os.getenv("AUTH_ADMIN_DISPLAY_NAME", "平台管理员").strip(),
            student_username=os.getenv("AUTH_STUDENT_USERNAME", "").strip().lower(),
            student_password=os.getenv("AUTH_STUDENT_PASSWORD", ""),
            student_display_name=os.getenv("AUTH_STUDENT_DISPLAY_NAME", "实验学生").strip(),
        )
