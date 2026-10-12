"""
config.py
---------
Configuration settings for KU-advisor backend.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv(override=True)

BASE_DIR: Path = Path(__file__).parent
ADMIN_DIR: Path = BASE_DIR.parent / "admin_files"

GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "").strip(' "\'')
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.6-flash").strip(' "\'')
