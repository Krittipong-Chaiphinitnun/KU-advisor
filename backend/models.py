"""
models.py
---------
SQLAlchemy ORM models mapped to Microsoft SQL Server database `ku_advisor`.

Tables:
- Users    — student, advisor, and admin accounts
- ChatLogs — user questions, AI responses, and telemetry
"""

from datetime import datetime
from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class User(Base):
    """
    Represents a registered student/admin account in `Users` table.
    """
    __tablename__ = "Users"
    __table_args__ = {"implicit_returning": False}

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)
    student_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str | None] = mapped_column(String(150), nullable=True, unique=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="student")
    faculty: Mapped[str] = mapped_column(
        String(150), nullable=False, default="Faculty of Engineering at Sriracha"
    )
    major: Mapped[str | None] = mapped_column(String(150), nullable=True)
    daily_chat_quota: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    total_chats_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_chat_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)

    # Relationships
    chat_logs: Mapped[list["ChatLog"]] = relationship(
        "ChatLog", back_populates="user", cascade="all, delete-orphan", order_by="ChatLog.created_at"
    )

    # Property alias so frontend user.id works seamlessly
    @property
    def id(self) -> int:
        return self.user_id

    def __repr__(self) -> str:
        return f"<User user_id={self.user_id} student_id={self.student_id!r} role={self.role!r}>"


class ChatLog(Base):
    """
    Represents chat inquiries and AI responses in `ChatLogs` table.
    """
    __tablename__ = "ChatLogs"
    __table_args__ = {"implicit_returning": False}

    chat_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("Users.user_id", ondelete="CASCADE"), nullable=False, index=True
    )
    session_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    user_message: Mapped[str] = mapped_column(Text, nullable=False)
    bot_response: Mapped[str] = mapped_column(Text, nullable=False)
    context_used: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    response_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    user_rating: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="chat_logs")

    @property
    def id(self) -> int:
        return self.chat_id

    def __repr__(self) -> str:
        return f"<ChatLog chat_id={self.chat_id} user_id={self.user_id}>"
