from django.urls import path

from . import assistant

app_name = "assistant"

urlpatterns = [
    path("<int:business_id>/", assistant.chat_page, name="chat_page"),
    path("<int:business_id>/ask/", assistant.ask, name="ask"),
    path("<int:business_id>/reset/", assistant.reset_conversation, name="reset"),
]
