"""
main.py
-------
FastAPI entry-point for KU-advisor — AI Academic Advising System.
Directly connected to Microsoft SQL Server (SSMS) database `ku_advisor` on server `FOCUS`.

Endpoints
---------
GET  /                      → health-check & database connection status
GET  /api/status            → RAG engine status (loaded files, char count)
POST /api/auth/register     → register a new student account (persists to SSMS Users)
POST /api/auth/login        → authenticate and return user info
GET  /api/history/{user_id} → retrieve all advising sessions + messages from SSMS ChatLogs
POST /api/chat              → AI advising (saves Q&A to SSMS ChatLogs automatically)
POST /api/admin/reload      → hot-reload PDF cache without restarting
"""

import io
import logging
import os
import time
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai.errors import APIError
from passlib.context import CryptContext
from PIL import Image
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import Base, DATABASE_URL, engine, get_db
from models import ChatLog, User
from rag_engine import (
    generate_content_with_retry,
    get_context,
    get_loaded_files,
    load_admin_pdfs,
)
from schemas import (
    ChatMessageResponse,
    HistoryResponse,
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    SessionResponse,
    UserResponse,
)

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Load environment variables ────────────────────────────────────────────────
load_dotenv(override=True)

GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")
if not GOOGLE_API_KEY:
    raise RuntimeError(
        "GOOGLE_API_KEY is not set. "
        "Add it to your .env file: GOOGLE_API_KEY=<your-key>"
    )

GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.6-flash").strip(' "\'')

# ── Gemini client (module-level singleton) ────────────────────────────────────
gemini_client = genai.Client(api_key=GOOGLE_API_KEY.strip(' "\''))

# ── Password hashing (bcrypt) ─────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── Lifespan: verify DB connection + pre-load PDFs ───────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("\n" + "=" * 70)
    print(f"[KU-advisor] Starting Server...")
    print(f"[Database Target]: {DATABASE_URL}")
    print("=" * 70)
    logger.info("Connecting to Database: %s", DATABASE_URL)

    try:
        with engine.connect() as conn:
            db_version = conn.execute(text("SELECT @@VERSION")).scalar()
            first_line = db_version.split("\n")[0] if db_version else "Unknown"
            print(f"[Database Connection Verified]: {first_line}")
            logger.info("Database verified: %s", first_line)
    except Exception as exc:
        print(f"[Database Connection Failed]: {exc}")
        logger.error("Could not connect to Database: %s", exc)

    logger.info("Pre-loading PDF knowledge base …")
    load_admin_pdfs()
    logger.info("Server ready.")
    yield
    logger.info("Server shutting down.")


# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="KU-advisor API",
    description="AI Academic Advising System powered by Gemini 3.6 Flash + RAG + SQL Server",
    version="2.0.0",
    lifespan=lifespan,
)

# ── CORS — allow all origins so React Native / Web client can call this API ───
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Health routes
# =============================================================================


@app.get("/", tags=["Health"])
async def root():
    """Quick liveness probe with DB connection info."""
    return {
        "service": "KU-advisor API",
        "status": "running",
        "database": DATABASE_URL,
        "model": GEMINI_MODEL,
    }


@app.get("/api/status", tags=["Health"])
async def api_status():
    """Return the current state of the RAG engine cache and DB connection."""
    files = get_loaded_files()
    context = get_context()
    return {
        "database": DATABASE_URL,
        "loaded_files": files,
        "file_count": len(files),
        "context_chars": len(context),
        "context_preview": context[:300] + "…" if len(context) > 300 else context,
    }


# =============================================================================
# Auth routes
# =============================================================================


@app.post(
    "/api/auth/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Auth"],
)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    """
    Register a new student (or admin) account directly in SSMS `Users` table.
    """
    existing = db.query(User).filter(User.student_id == body.student_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"student_id '{body.student_id}' is already registered.",
        )

    raw_email = getattr(body, "email", None)
    user_email = raw_email.strip() if raw_email and raw_email.strip() else f"{body.student_id.strip()}@ku.th"

    new_user = User(
        student_id=body.student_id.strip(),
        password_hash=hash_password(body.password),
        full_name=body.full_name.strip(),
        email=user_email,
        role=body.role,
        faculty="Faculty of Engineering at Sriracha",
        daily_chat_quota=50,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    logger.info(
        "Registered new user in SSMS: student_id=%s user_id=%s email=%s role=%s",
        new_user.student_id,
        new_user.user_id,
        new_user.email,
        new_user.role,
    )
    return UserResponse.model_validate(new_user)


@app.post("/api/auth/login", response_model=LoginResponse, tags=["Auth"])
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate with **student_id** and **password** against SSMS `Users`.
    """
    user = db.query(User).filter(User.student_id == body.student_id).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid student_id or password.",
        )
    logger.info("Login successful: student_id=%s (user_id=%d)", user.student_id, user.user_id)
    return LoginResponse(message="Login successful.", user=UserResponse.model_validate(user))


# =============================================================================
# History route
# =============================================================================


@app.get("/api/history/{user_id}", response_model=HistoryResponse, tags=["History"])
def get_history(user_id: int, db: Session = Depends(get_db)):
    """
    Retrieve all advising chat logs from SSMS `ChatLogs` for a given **user_id**.
    """
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No user found with id={user_id}.",
        )

    logs = (
        db.query(ChatLog)
        .filter(ChatLog.user_id == user_id)
        .order_by(ChatLog.created_at.desc())
        .all()
    )

    # Format each ChatLog into an advising session card with user & AI message turns
    session_responses: list[SessionResponse] = []
    for log in logs:
        messages = [
            ChatMessageResponse(
                id=log.chat_id * 2 - 1,
                sender="user",
                content=log.user_message,
                image_url=log.image_url,
                created_at=log.created_at,
            ),
            ChatMessageResponse(
                id=log.chat_id * 2,
                sender="ai",
                content=log.bot_response,
                image_url=None,
                created_at=log.created_at,
            ),
        ]
        session_responses.append(
            SessionResponse(
                id=log.chat_id,
                created_at=log.created_at,
                messages=messages,
            )
        )

    return HistoryResponse(
        user_id=user_id,
        sessions=session_responses,
    )


# =============================================================================
# Chat route (main advising endpoint)
# =============================================================================


@app.post("/api/chat", tags=["Chat"])
async def chat(
    prompt: str = Form(..., description="Student question or advising request"),
    user_id: int | None = Form(None, description="DB user.id (optional, enables history saving)"),
    image_file: UploadFile | None = File(
        None, description="Optional transcript / grade screenshot (PNG / JPG)"
    ),
    image_base64: str | None = Form(
        None, description="Optional base64 encoded image string"
    ),
    db: Session = Depends(get_db),
):
    """
    Main advising endpoint.

    1. Fetches pre-cached curriculum PDF context (RAG).
    2. Combines context + prompt (+ image if provided) and invokes Gemini 3.6 Flash.
    3. Persists inquiry & response directly into SSMS `ChatLogs` (calling commit & refresh).
    """
    if not prompt.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="prompt must not be empty.",
        )

    curriculum_context = get_context()
    if not curriculum_context:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "No curriculum data is loaded. "
                "Please add PDF files to the admin_files directory."
            ),
        )

    # ── Validate user_id if provided ─────────────────────────────────────────
    db_user: User | None = None
    if user_id is not None:
        db_user = db.query(User).filter(User.user_id == user_id).first()
        if not db_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No user found with id={user_id}.",
            )

    # ── Build the content list sent to Gemini ────────────────────────────────
    system_instruction = (
        "You are KU-advisor, an expert AI academic advisor for Kasetsart University. "
        "You MUST answer only from the curriculum documents provided. "
        "If the answer cannot be found in the documents, say so clearly. "
        "Always respond in the same language the student used. "
        "Be concise, structured, and helpful."
    )

    contents: list = [
        system_instruction,
        "Below is the complete curriculum reference document:\n\n",
        curriculum_context,
        "\n\n---\n",
    ]

    if db_user:
        contents.append(f"[Student: {db_user.full_name} | ID: {db_user.student_id}]\n")

    contents.append(f"Student question: {prompt}")

    # ── Attach image if provided (Multipart UploadFile or Base64 string) ──────
    image_url_saved: str | None = None
    pil_image: Image.Image | None = None

    # 1. Attempt reading UploadFile
    if image_file is not None:
        try:
            raw_bytes = await image_file.read()
            if raw_bytes and len(raw_bytes) > 0 and raw_bytes != b"[object Object]":
                pil_image = Image.open(io.BytesIO(raw_bytes))
                pil_image.load()
                image_url_saved = image_file.filename or "transcript.jpg"
        except Exception as exc:
            logger.warning("Could not decode image_file: %s", exc)

    # 2. Fallback to image_base64
    if pil_image is None and image_base64 and image_base64.strip():
        try:
            import base64
            b64_clean = image_base64.strip()
            if "base64," in b64_clean:
                b64_clean = b64_clean.split("base64,")[1]
            raw_bytes = base64.b64decode(b64_clean)
            if raw_bytes and len(raw_bytes) > 0:
                pil_image = Image.open(io.BytesIO(raw_bytes))
                pil_image.load()
                image_url_saved = "transcript.jpg"
        except Exception as exc:
            logger.warning("Could not decode image_base64: %s", exc)

    # 3. Add PIL Image to Gemini contents
    if pil_image is not None:
        try:
            if pil_image.mode not in ("RGB", "L"):
                pil_image = pil_image.convert("RGB")
            contents.append(
                "\nThe student has attached the following image "
                "(transcript / grades / schedule / curriculum document) as additional context:"
            )
            contents.append(pil_image)
            logger.info("Attached image to Gemini contents (size=%s, mode=%s)", pil_image.size, pil_image.mode)
        except Exception as exc:
            logger.warning("Failed to prepare image for Gemini: %s", exc)

    # ── Call Gemini (Direct gemini-3.6-flash with retry on rate limits) ───────
    start_time = time.time()
    try:
        logger.info(
            "Sending advising request (primary_model=%s, user_id=%s, has_image=%s)",
            GEMINI_MODEL,
            user_id,
            pil_image is not None,
        )
        response = generate_content_with_retry(
            client=gemini_client,
            contents=contents,
            model=GEMINI_MODEL,
            max_retries=5,
            base_delay=2.0,
        )
        reply_text: str = response.text
        elapsed_ms = int((time.time() - start_time) * 1000)

    except APIError as exc:
        error_str = str(exc)
        logger.error("Gemini APIError: %s", error_str)
        if "429" in error_str:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit reached (429). Please wait 20–30 seconds and try again.",
            )
        if "503" in error_str or "unavailable" in error_str.lower():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Gemini API is currently experiencing high demand (503). Please try again in a moment.",
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gemini API error: {error_str}",
        )

    except Exception as exc:
        logger.exception("Unexpected error during generate_content")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected server error: {exc}",
        )

    # ── Persist Q&A to SSMS ChatLogs (Calling db.commit() and db.refresh()) ───
    session_id: int | None = None
    if db_user is not None:
        try:
            session_uuid = f"sess_{int(time.time())}"
            new_log = ChatLog(
                user_id=db_user.user_id,
                session_id=session_uuid,
                user_message=prompt,
                bot_response=reply_text,
                context_used=curriculum_context[:1000] if curriculum_context else None,
                image_url=image_url_saved,
                response_time_ms=elapsed_ms,
            )
            db.add(new_log)
            db.commit()
            db.refresh(new_log)

            session_id = new_log.chat_id
            logger.info(
                "Saved ChatLog id=%d for user_id=%d in SSMS database",
                session_id,
                db_user.user_id,
            )
        except Exception as exc:
            db.rollback()
            logger.error("Failed to persist chat to SSMS DB: %s", exc)

    return {
        "reply": reply_text,
        "user_id": user_id,
        "session_id": session_id,
        "model": GEMINI_MODEL,
    }


# =============================================================================
# Admin routes
# =============================================================================


@app.post("/api/admin/reload", tags=["Admin"])
async def reload_pdfs():
    """
    Force-reload the PDF cache from disk without restarting the server.
    """
    try:
        text, files = load_admin_pdfs(force_reload=True)
        return {
            "message": "PDF cache reloaded successfully.",
            "loaded_files": files,
            "context_chars": len(text),
        }
    except Exception as exc:
        logger.exception("Failed to reload PDFs")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Reload failed: {exc}",
        )
