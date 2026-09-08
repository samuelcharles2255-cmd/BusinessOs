"""
Context processors for Biashara OS.
Provides active language context and translation dictionary to all templates.
"""
import json
from django.utils import translation
from .translations import TRANSLATIONS_SW, translate_text


def biashara_i18n(request):
    """
    Supplies language context to all rendered templates.
    """
    # 1. Session check
    lang = request.session.get("biashara_lang") or request.session.get("_language")

    # 2. Cookie check
    if not lang:
        lang = request.COOKIES.get("biashara_lang") or request.COOKIES.get("django_language")

    # 3. Active Django language check
    if not lang:
        lang = translation.get_language() or "en"

    # Normalize to 2-char code
    if lang.startswith("sw"):
        lang = "sw"
    else:
        lang = "en"

    return {
        "current_lang": lang,
        "is_swahili": (lang == "sw"),
        "translations_sw_json": json.dumps(TRANSLATIONS_SW) if lang == "sw" else "{}",
    }
