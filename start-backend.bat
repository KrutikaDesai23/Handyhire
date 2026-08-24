@echo off
title HandyHire Backend
echo Starting HandyHire Backend on http://127.0.0.1:8000 ...
powershell -ExecutionPolicy Bypass -File "%~dp0start-backend.ps1"
pause
