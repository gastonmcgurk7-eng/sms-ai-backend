#!/bin/bash
set -e

echo "=== Building React Frontend Static Assets ==="
npm run build

# Ensure pip3 is installed (non-interactive, safe configuration)
if ! command -v pip3 &> /dev/null; then
    echo "pip3 command not found. Initializing safe, non-interactive installation..."
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y --no-install-recommends -o Dpkg::Options::="--force-confold" -o Dpkg::Options::="--force-confdef" python3-pip python3-venv
fi

echo "=== Installing Python Dependencies from requirements.txt ==="
pip3 install --break-system-packages --no-cache-dir -r requirements.txt

echo "=== Starting FastAPI Server on Port 3000 ==="
exec uvicorn main:app --host 0.0.0.0 --port 3000
