from django import template
from BusinessOs.translations import translate_text

register = template.Library()


@register.filter(name="t")
def t_filter(value, lang="sw"):
    """
    Translates an English string to Swahili if lang is 'sw'.
    Usage: {{ "Dashboard"|t:current_lang }} or {{ "Dashboard"|t }}
    """
    if not value:
        return value
    return translate_text(str(value), lang=lang)


@register.simple_tag(takes_context=True)
def trans_sw(context, text):
    """
    Translates an English string according to the active context language.
    Usage: {% trans_sw "Record Sale" %}
    """
    lang = context.get("current_lang", "en")
    return translate_text(text, lang=lang)

