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
    echo "Notice: DATABASE_URL is not set. Running migrations with fallback database..."
    python manage.py migrate --no-input || echo "Warning: Migrations failed. Ensure DATABASE_URL is set in Render environment variables."
fi

# Automatically create superuser if DJANGO_SUPERUSER_USERNAME & DJANGO_SUPERUSER_PASSWORD are set
if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
    echo "==> Setting up superuser from environment variables..."
    python manage.py createsuperuser --no-input || true
fi

echo "==> Build process completed successfully!"
