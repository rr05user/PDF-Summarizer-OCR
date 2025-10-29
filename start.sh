#!/usr/bin/env bash
set -e

echo "🚀 Starting Flask app inside container..."

# 1. Handle Google service account JSON
if [[ -n "$GOOGLE_CREDENTIALS_JSON" ]]; then
  echo "Writing Google credentials from env..."
  mkdir -p /secrets
  echo "$GOOGLE_CREDENTIALS_JSON" > /secrets/vision-sa.json
  export GOOGLE_APPLICATION_CREDENTIALS=/secrets/vision-sa.json
elif [[ -f "/secrets/vision-sa.json" ]]; then
  echo "Using mounted Google credentials file."
  export GOOGLE_APPLICATION_CREDENTIALS=/secrets/vision-sa.json
else
  echo "⚠️ No Google credentials found! OCR will fail unless GOOGLE_CREDENTIALS_JSON or /secrets/vision-sa.json is provided."
fi

# 2. Ensure persistent folders exist
mkdir -p /data/uploads

# 3. Default envs (these can be overridden)
export SQLALCHEMY_DATABASE_URI="${SQLALCHEMY_DATABASE_URI:-sqlite:////data/receipts.db}"
export UPLOAD_FOLDER="${UPLOAD_FOLDER:-/data/uploads}"
export CORS_ORIGINS="${CORS_ORIGINS:-*}"

# 4. Run with gunicorn (production mode)
WORKERS=${WORKERS:-1}   # default to 1 to avoid SQLite races
exec gunicorn -w "$WORKERS" -k gthread -b 0.0.0.0:5000 app_api:app