from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.db.models import Q

from .utils import normalize_phone

User = get_user_model()


class PhoneOrUsernameBackend(ModelBackend):
    """
    Authenticate against settings.AUTH_USER_MODEL using username, phone number,
    or email address.
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        if not username or not password:
            return None

        raw_identifier = username.strip()
        users = []

        # 1. Try exact username match (case-insensitive)
        u = User.objects.filter(username__iexact=raw_identifier).first()
        if u:
            users.append(u)

        # 2. Try email match
        if not users and "@" in raw_identifier:
            u = User.objects.filter(email__iexact=raw_identifier).first()
            if u:
                users.append(u)

        # 3. Try phone match via UserProfile
        if not users:
            try:
                norm_phone = normalize_phone(raw_identifier)
                u = User.objects.filter(profile__phone=norm_phone).first()
                if u:
                    users.append(u)
            except Exception:
                pass

        # 4. Fallback: match profile__phone with raw input or username as phone
        if not users:
            u = User.objects.filter(
                Q(profile__phone=raw_identifier) | Q(username=raw_identifier)
            ).first()
            if u:
                users.append(u)

        for user in users:
            if user.check_password(password) and self.user_can_authenticate(user):
                return user

        return None

