@echo off
echo Setting up Python scraper sidecar...

cd /d "%~dp0"

if not exist ".venv" (
    echo Creating virtual environment...
    python -m venv .venv
)

echo Activating venv and installing dependencies...
call .venv\Scripts\activate.bat
pip install -r requirements.txt

echo Setup complete.
echo Run with: .venv\Scripts\python scraper_service.py
