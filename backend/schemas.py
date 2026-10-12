"""
schemas.py
----------
Pydantic v2 request / response contracts for KU-advisor API.
Keeps validation logic out of main.py and models.py.
"""

from datetime import datetime

from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# Auth
# ─────────────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    student_id: str = Field(..., min_length=1, max_length=50, examples=["6510405001"])
    password: str = Field(..., min_length=6, max_length=128)
    full_name: str = Field(..., min_length=1, max_length=200, examples=["สมชาย ใจดี"])
    email: str | None = Field(default=None, max_length=150)
    role: str = Field(default="student", pattern="^(student|admin)$")


class LoginRequest(BaseModel):
    student_id: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1)


class UserResponse(BaseModel):
    id: int
    student_id: str
    full_name: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    message: str
    user: UserResponse


# ─────────────────────────────────────────────────────────────────────────────
# Chat history
# ─────────────────────────────────────────────────────────────────────────────

class ChatMessageResponse(BaseModel):
    id: int
    sender: str
    content: str
    image_url: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionResponse(BaseModel):
    id: int
    created_at: datetime
    messages: list[ChatMessageResponse]

    model_config = {"from_attributes": True}


class HistoryResponse(BaseModel):
    user_id: int
    sessions: list[SessionResponse]
