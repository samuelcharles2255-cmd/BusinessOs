from django.urls import path

from . import assistant

app_name = "assistant"

urlpatterns = [
    path("<int:business_id>/", assistant.chat_page, name="chat_page"),
    path("<int:business_id>/ask/", assistant.ask, name="ask"),
    path("<int:business_id>/reset/", assistant.reset_conversation, name="reset"),
]

# Support URLs both with and without trailing slash
_extra_patterns = []
for p in urlpatterns:
    if hasattr(p, "pattern"):
        pat = str(p.pattern)
        if pat.endswith("/"):
            _extra_patterns.append(
                path(pat[:-1], p.callback, name=f"{p.name}_noslash" if p.name else None)
            )
urlpatterns += _extra_patterns

