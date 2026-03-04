#!/usr/bin/env bash
set -euo pipefail

echo "Setting up Python scraper sidecar..."

cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
fi

echo "Activating venv and installing dependencies..."
source .venv/bin/activate
pip install -r requirements.txt

echo "Setup complete."
echo "Run with: .venv/bin/python scraper_service.py"
