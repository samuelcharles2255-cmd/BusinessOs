#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "==> Upgrading pip..."
python -m pip install --upgrade pip

echo "==> Installing Python dependencies..."
pip install -r requirements.txt

echo "==> Collecting static files..."
python manage.py collectstatic --no-input

echo "==> Running database migrations..."
if [ -n "$DATABASE_URL" ]; then
    echo "DATABASE_URL is set, applying database migrations..."
    python manage.py migrate --no-input
else
    echo "Notice: DATABASE_URL is not set. Skipping migrations during build phase."
fi

echo "==> Build process completed successfully!"
