@echo off

cd /d "%~dp0"

echo.
echo ==========================================
echo   Dutch Vocabulary Trainer V1.1
echo ==========================================
echo.
echo Starting local server...
echo.
echo Open:
echo http://localhost:8000
echo.
echo Close this window to stop the trainer.
echo.

python -m http.server 8000

pause