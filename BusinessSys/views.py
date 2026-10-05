"""
BusinessSys/views.py — Root handlers redirecting traffic to Next.js frontend.
"""
import os
from django.http import JsonResponse
from django.shortcuts import redirect

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")


def frontend_redirect_or_api_info(request, *args, **kwargs):
    # If a browser requests HTML, redirect to Next.js frontend
    accept = request.headers.get("accept", "")
    if "text/html" in accept:
        # Map path to frontend
        target_path = request.path
        return redirect(f"{FRONTEND_URL}{target_path}")

    return JsonResponse(
        {
            "status": "active",
            "name": "Biashara OS REST API",
            "message": "Templates disabled. Frontend is running on Next.js.",
            "frontend_url": FRONTEND_URL,
            "api_root": "/api/",
        }
    )

