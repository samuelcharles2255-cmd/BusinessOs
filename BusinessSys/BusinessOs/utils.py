"""Shared helpers used across the app."""

from django.core.exceptions import ValidationError


def normalize_phone(raw):
    """
    Tanzanian phone numbers show up as 0712345678, 255712345678, or
    +255712345678 -- three strings, one real number. Always run a phone
    through this BEFORE saving it AND before using it to look an existing
    record up.
    """
    if not raw:
        raise ValidationError("Phone number is required.")

    digits = "".join(ch for ch in raw if ch.isdigit())

    if digits.startswith("255"):
        digits = digits[3:]
    elif digits.startswith("0"):
        digits = digits[1:]

    if len(digits) != 9 or not digits.startswith(("6", "7")):
        raise ValidationError(
            "'%(raw)s' doesn't look like a valid Tanzanian phone number "
            "(expected something like 0712345678 or +255712345678)." % {"raw": raw}
        )

    return "+255" + digits