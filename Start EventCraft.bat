@echo off
cd /d "%~dp0"
start "EventCraft AI server" cmd /k "node server.mjs"
timeout /t 2 /nobreak >nul
start "" "http://localhost:4173"
