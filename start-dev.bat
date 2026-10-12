@echo off
title KU-advisor Auto Launcher
echo Starting Backend, Localtunnel, and Frontend...

start "1. FastAPI Backend" cmd /k "cd /d D:\KU-advisor\backend && ..\venv\Scripts\python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"
start "2. Localtunnel" cmd /k "cd /d D:\KU-advisor && npx localtunnel --port 8000 --subdomain ku-advisor-sriracha-app"
start "3. Expo Frontend" cmd /k "cd /d D:\KU-advisor\frontend && npx expo start -c"

echo All services are starting up!