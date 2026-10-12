"""
rag_engine.py
-------------
Loads every PDF inside ./admin_files at startup, extracts plain text with
PyMuPDF (fitz), concatenates the results, and caches the final string in
module-level memory so the heavy I/O only happens once per server process.

The extracted context is hard-capped at MAX_CONTEXT_CHARS characters to avoid
hitting Gemini TPM (tokens-per-minute) rate limits.
"""

import os
import time
import logging
from pathlib import Path

import fitz  # PyMuPDF

logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────────────────
ADMIN_DIR: Path = Path(__file__).parent.parent / "admin_files"
MAX_CONTEXT_CHARS: int = 20_000  # ~5 k tokens — stays well below TPM limits

# ── Module-level cache (populated once on first call) ────────────────────────
_cached_text: str | None = None
_loaded_files: list[str] = []


def _extract_text_from_pdf(pdf_path: Path) -> str:
    """Return the concatenated plain text of every page in *pdf_path*."""
    try:
        doc = fitz.open(str(pdf_path))
        pages_text = "".join(page.get_text() for page in doc)
        doc.close()
        logger.info("  loaded '%s' (%d chars)", pdf_path.name, len(pages_text))
        return pages_text
    except Exception as exc:
        logger.warning("  Could not read '%s': %s", pdf_path.name, exc)
        return ""


def load_admin_pdfs(force_reload: bool = False) -> tuple[str, list[str]]:
    """
    Walk ADMIN_DIR, extract text from every PDF, concatenate, cache and
    return (truncated_text, [list_of_filenames]).
    """
    global _cached_text, _loaded_files

    if _cached_text is not None and not force_reload:
        return _cached_text, _loaded_files

    logger.info("Scanning '%s' for PDF files ...", ADMIN_DIR)

    if not ADMIN_DIR.exists():
        ADMIN_DIR.mkdir(parents=True, exist_ok=True)
        logger.warning("admin_files directory was missing — created an empty one.")
        _cached_text, _loaded_files = "", []
        return _cached_text, _loaded_files

    pdf_paths = sorted(ADMIN_DIR.glob("*.pdf"))

    if not pdf_paths:
        logger.warning("No PDF files found in '%s'.", ADMIN_DIR)
        _cached_text, _loaded_files = "", []
        return _cached_text, _loaded_files

    all_text_parts: list[str] = []
    file_names: list[str] = []

    for pdf_path in pdf_paths:
        header = (
            f"\n\n{'=' * 60}\n"
            f"Document: {pdf_path.name}\n"
            f"{'=' * 60}\n"
        )
        body = _extract_text_from_pdf(pdf_path)
        all_text_parts.append(header + body)
        file_names.append(pdf_path.name)

    full_text = "".join(all_text_parts)
    truncated = full_text[:MAX_CONTEXT_CHARS]

    if len(full_text) > MAX_CONTEXT_CHARS:
        logger.warning(
            "PDF corpus (%d chars) exceeded MAX_CONTEXT_CHARS=%d — truncated.",
            len(full_text),
            MAX_CONTEXT_CHARS,
        )

    logger.info(
        "RAG engine ready: %d file(s), %d/%d chars used.",
        len(file_names),
        len(truncated),
        len(full_text),
    )

    _cached_text = truncated
    _loaded_files = file_names
    return _cached_text, _loaded_files


def get_context() -> str:
    """Return the cached curriculum context string (loads on first call)."""
    text, _ = load_admin_pdfs()
    return text


def get_loaded_files() -> list[str]:
    """Return the list of filenames that were successfully loaded."""
    _, files = load_admin_pdfs()
    return files


# ── Gemini Helper: List Models on Startup ──────────────────────────────────────
def check_available_models(client) -> list[str]:
    """Query Gemini API to list all available models for this API key."""
    try:
        available = []
        for m in client.models.list():
            m_name = m.name.replace("models/", "")
            available.append(m_name)
        logger.info("✅ [Gemini API] Available models: %s", available)
        return available
    except Exception as exc:
        logger.warning("⚠️ Could not list Gemini models: %s", exc)
        return []


# ── Gemini Robust Invocation (Direct gemini-3.6-flash + Exponential Backoff Retries) ─
PRIMARY_MODEL: str = "gemini-3.6-flash"


def generate_content_with_retry(
    client,
    contents,
    model: str = PRIMARY_MODEL,
    fallback_models: list[str] | None = None,
    max_retries: int = 4,
    base_delay: float = 5.0,
    max_delay: float = 10.0,
    retry_delay: float | None = None,  # Backward compatibility alias for base_delay
):
    """
    Call Gemini API directly with gemini-3.6-flash, with automatic retry and backoff on 503/429.
    For HTTP 429 (Rate Limit / Too Many Requests), pauses and sleeps for 5 to 10 seconds before retrying,
    allowing up to 4 retries to handle API cooldowns seamlessly.
    Fails immediately on 404/not_found without wasting time on invalid model fallbacks.
    """
    from google.genai.errors import APIError

    # Clean model string: remove leading 'models/' prefix, spaces, and quotes
    clean_model = (model or PRIMARY_MODEL).replace("models/", "").strip(' "\'')
    initial_delay = retry_delay if retry_delay is not None else base_delay

    # Allow up to 4 retries (1 initial attempt + max_retries retries = total_attempts)
    max_retry_attempts = max(max_retries, 4)
    total_attempts = max_retry_attempts + 1

    logger.info(
        "Executing Gemini content generation using model: '%s' (max_retries=%d, total_attempts=%d)",
        clean_model,
        max_retry_attempts,
        total_attempts,
    )
    last_error = None

    for attempt in range(1, total_attempts + 1):
        try:
            response = client.models.generate_content(
                model=clean_model,
                contents=contents,
            )
            if attempt > 1:
                logger.info(
                    "Successfully received response from model '%s' on retry attempt %d/%d",
                    clean_model,
                    attempt - 1,
                    max_retry_attempts,
                )
            return response

        except APIError as exc:
            last_error = exc
            error_str = str(exc).lower()
            status_code = getattr(exc, "code", None) or getattr(exc, "status_code", None)

            # If 404/not_found, fail immediately without retrying or fallback loop
            if "404" in error_str or "not_found" in error_str or status_code == 404:
                logger.error("Model '%s' not found (404): %s", clean_model, exc)
                raise exc

            is_429 = (
                status_code == 429
                or "429" in error_str
                or "resource_exhausted" in error_str
                or "rate limit" in error_str
                or "rate_limit" in error_str
                or "too many requests" in error_str
                or "quota" in error_str
            )
            is_503 = (
                status_code == 503
                or "503" in error_str
                or "unavailable" in error_str
                or "high demand" in error_str
                or "overloaded" in error_str
                or "server error" in error_str
            )

            if (is_429 or is_503) and attempt <= max_retry_attempts:
                if is_429:
                    # HTTP 429 Rate Limit cooldown: Pause and sleep 5 to 10 seconds before retrying
                    # Progressive backoff: retry 1 -> 5.0s, retry 2 -> 6.5s, retry 3 -> 8.0s, retry 4 -> 9.5s
                    retry_idx = attempt
                    cooldown_delay = min(5.0 + (retry_idx - 1) * 1.5, 10.0)
                    cooldown_delay = max(5.0, min(cooldown_delay, 10.0))
                    logger.warning(
                        "Gemini %s returned 429 (Rate Limit / Too Many Requests) on attempt %d/%d (retry %d/%d). "
                        "Pausing and sleeping for %.1f seconds before retry... [Detail: %s]",
                        clean_model,
                        attempt,
                        total_attempts,
                        retry_idx,
                        max_retry_attempts,
                        cooldown_delay,
                        exc,
                    )
                    time.sleep(cooldown_delay)
                    continue
                else:
                    # 503 Service Unavailable / High Demand
                    backoff_delay = min(initial_delay * (2 ** (attempt - 1)), max_delay)
                    logger.warning(
                        "Gemini %s returned 503 (High Demand / Service Unavailable) on attempt %d/%d (retry %d/%d). "
                        "Exponential backoff sleeping %.1fs before retry... [Detail: %s]",
                        clean_model,
                        attempt,
                        total_attempts,
                        attempt,
                        max_retry_attempts,
                        backoff_delay,
                        exc,
                    )
                    time.sleep(backoff_delay)
                    continue

            logger.error("API error on model '%s' after attempt %d/%d: %s", clean_model, attempt, total_attempts, exc)
            raise exc

        except Exception as exc:
            last_error = exc
            error_str = str(exc).lower()
            is_429_generic = (
                "429" in error_str
                or "resource_exhausted" in error_str
                or "rate limit" in error_str
                or "rate_limit" in error_str
                or "too many requests" in error_str
                or "quota" in error_str
            )
            if is_429_generic and attempt <= max_retry_attempts:
                retry_idx = attempt
                cooldown_delay = min(5.0 + (retry_idx - 1) * 1.5, 10.0)
                cooldown_delay = max(5.0, min(cooldown_delay, 10.0))
                logger.warning(
                    "Non-API 429 Rate Limit error on model '%s' (attempt %d/%d, retry %d/%d): %s. Sleeping %.1fs...",
                    clean_model,
                    attempt,
                    total_attempts,
                    retry_idx,
                    max_retry_attempts,
                    exc,
                    cooldown_delay,
                )
                time.sleep(cooldown_delay)
                continue

            logger.warning(
                "Non-API exception on model '%s' (attempt %d/%d): %s",
                clean_model,
                attempt,
                total_attempts,
                exc,
            )
            if attempt <= max_retry_attempts:
                backoff_delay = min(initial_delay * (2 ** (attempt - 1)), max_delay)
                time.sleep(backoff_delay)
                continue
            raise exc

    if last_error:
        raise last_error
    raise RuntimeError(f"Failed to generate content with model '{clean_model}' after {max_retry_attempts} retries.")


