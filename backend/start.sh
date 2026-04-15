#!/bin/bash
cd /var/www/laskenta/backend
source /var/www/laskenta/backend/venv/bin/activate
set -a
source /var/www/laskenta/backend/.env
set +a
exec /var/www/laskenta/backend/venv/bin/uvicorn server:app --host 127.0.0.1 --port 8001 --workers 2
