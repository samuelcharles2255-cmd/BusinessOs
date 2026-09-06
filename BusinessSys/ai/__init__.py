"""
Biashara OS -- AI Business Assistant.

A Gemini-backed assistant that answers questions about a Business's own
recorded data (sales, purchases, expenses, people) -- and nothing else.
See tools.py for the "without guessing" mechanism: every number the
assistant states comes from a real, read-only query, never from the
model's own memory or estimation.

Files:
  prompts.py   -- the system instruction defining tone and the grounding rule
  tools.py     -- the read-only query functions Gemini is allowed to call
  assistant.py -- the tool-calling loop + the two Django views
  urls.py      -- routes for the chat page and its JSON endpoint

Setup:
  pip install google-genai
  settings.py: GEMINI_API_KEY = "<your key>"
  INSTALLED_APPS += ["assistant"]
  project urls.py: path("assistant/", include("assistant.urls"))
  template: assistant/templates/assistant/chat.html (see below)
"""