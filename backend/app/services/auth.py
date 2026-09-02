from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from pwdlib import PasswordHash
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError

from app.config import AppSettings
from app.storage import AuthSessionRecord, StateRepository, UserRecord


password_hash = PasswordHash.recommended()


def utc_now() -> datetime:
    return datetime.now(UTC)


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


class AuthService:
    def __init__(self, repository: StateRepository, settings: AppSettings) -> None:
        self.repository = repository
        self.settings = settings

    @staticmethod
    def public_user(user: UserRecord) -> dict[str, Any]:
        return {
            "id": user.id,
            "username": user.username,
            "display_name": user.display_name,
            "role": user.role,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat(),
            "last_login_at": user.last_login_at.isoformat()
            if user.last_login_at
            else None,
        }

    def create_user(
        self, username: str, display_name: str, role: str, password: str
    ) -> dict[str, Any]:
        normalized = username.strip().lower()
        normalized_display_name = display_name.strip()
        if role not in {"student", "admin"}:
            raise ValueError("用户角色无效")
        if len(normalized_display_name) < 2:
            raise ValueError("姓名或昵称至少需要 2 个字符")
        if len(password) < 8:
            raise ValueError("密码至少需要 8 个字符")
        try:
            with self.repository.session() as session:
                if session.scalar(
                    select(UserRecord.id).where(UserRecord.username == normalized)
                ):
                    raise ValueError("用户名已存在")
                user = UserRecord(
                    id=f"usr_{uuid.uuid4().hex[:16]}",
                    username=normalized,
                    display_name=normalized_display_name,
                    role=role,
                    password_hash=password_hash.hash(password),
                    is_active=True,
                    failed_login_attempts=0,
                    created_at=utc_now(),
                )
                session.add(user)
                session.flush()
                return self.public_user(user)
        except IntegrityError as error:
            # 数据库唯一约束处理并发注册同一用户名的竞争条件。
            raise ValueError("用户名已存在") from error

    def ensure_bootstrap_users(self) -> dict[str, int]:
        created = 0
        for username, password, display_name, role in [
            (
                self.settings.admin_username,
                self.settings.admin_password,
                self.settings.admin_display_name,
                "admin",
            ),
            (
                self.settings.student_username,
                self.settings.student_password,
                self.settings.student_display_name,
                "student",
            ),
        ]:
            if not username or not password:
                continue
            with self.repository.Session() as session:
                exists = session.scalar(
                    select(UserRecord.id).where(UserRecord.username == username)
                )
            if not exists:
                self.create_user(username, display_name, role, password)
                created += 1
        with self.repository.Session() as session:
            count = len(list(session.scalars(select(UserRecord.id))))
        return {"created": created, "total": count}

    def authenticate(
        self, username: str, password: str, user_agent: str | None = None
    ) -> tuple[dict[str, Any], str]:
        normalized = username.strip().lower()
        now = utc_now()
        error_message: str | None = None
        result: tuple[dict[str, Any], str] | None = None
        with self.repository.session() as session:
            user = session.scalar(
                select(UserRecord).where(UserRecord.username == normalized)
            )
            if not user:
                error_message = "用户名或密码错误"
            elif not user.is_active:
                error_message = "账号已停用"
            elif user.locked_until and aware(user.locked_until) > now:
                error_message = "登录失败次数过多，请稍后再试"
            elif not password_hash.verify(password, user.password_hash):
                user.failed_login_attempts += 1
                if user.failed_login_attempts >= 5:
                    user.locked_until = now + timedelta(minutes=15)
                    user.failed_login_attempts = 0
                error_message = "用户名或密码错误"
            else:
                user.failed_login_attempts = 0
                user.locked_until = None
                user.last_login_at = now
                token = secrets.token_urlsafe(48)
                session.add(
                    AuthSessionRecord(
                        token_hash=token_digest(token),
                        user_id=user.id,
                        created_at=now,
                        expires_at=now
                        + timedelta(hours=self.settings.session_ttl_hours),
                        last_seen_at=now,
                        user_agent=(user_agent or "")[:400] or None,
                    )
                )
                session.flush()
                result = (self.public_user(user), token)

        if result:
            return result
        if error_message == "用户名或密码错误" and user is None:
            # 消耗与一次正常验证接近的成本，减少用户名枚举的时序差异。
            password_hash.hash(password)
        raise PermissionError(error_message or "登录失败")

    def user_for_token(self, token: str | None) -> dict[str, Any] | None:
        if not token:
            return None
        now = utc_now()
        with self.repository.session() as session:
            record = session.scalar(
                select(AuthSessionRecord).where(
                    AuthSessionRecord.token_hash == token_digest(token)
                )
            )
            if not record:
                return None
            if aware(record.expires_at) <= now or not record.user.is_active:
                session.delete(record)
                return None
            record.last_seen_at = now
            return self.public_user(record.user)

    def logout(self, token: str | None) -> None:
        if not token:
            return
        with self.repository.session() as session:
            session.execute(
                delete(AuthSessionRecord).where(
                    AuthSessionRecord.token_hash == token_digest(token)
                )
            )

    def list_users(self) -> list[dict[str, Any]]:
        with self.repository.Session() as session:
            users = list(
                session.scalars(select(UserRecord).order_by(UserRecord.created_at))
            )
            return [self.public_user(user) for user in users]

    def user_by_username(self, username: str) -> dict[str, Any] | None:
        with self.repository.Session() as session:
            user = session.scalar(
                select(UserRecord).where(
                    UserRecord.username == username.strip().lower()
                )
            )
            return self.public_user(user) if user else None
