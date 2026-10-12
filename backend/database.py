"""
database.py
-----------
SQLAlchemy engine + session factory for KU-advisor.
Connected to Microsoft SQL Server (SSMS) database `ku_advisor` on server `FOCUS`.
"""

import os
import logging
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

logger = logging.getLogger(__name__)

# Force reload of .env
load_dotenv(override=True)

# Strict SQL Server Default URL for FOCUS\ku_advisor
SQL_SERVER_DEFAULT_URL = (
    "mssql+pyodbc://@FOCUS/ku_advisor?"
    "driver=ODBC+Driver+17+for+SQL+Server&"
    "trusted_connection=yes&"
    "TrustServerCertificate=yes"
)

DATABASE_URL: str = os.getenv("DATABASE_URL", SQL_SERVER_DEFAULT_URL).strip(' "\'')

# Log the database target
logger.info("Initializing database connection with target: %s", DATABASE_URL)
print(f"[Database Engine] Configured DATABASE_URL: {DATABASE_URL}")

_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=_connect_args,
    echo=False,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""
    pass


def get_db():
    """
    FastAPI dependency yielding an active database session.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
