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
""""""
assistant.py -- the Gemini-backed tool-calling loop, plus the two Django
views that expose it (the chat page, and the JSON endpoint its JS calls).

No new models: conversation history lives in the session, capped at
MAX_HISTORY_TURNS, which is enough for a natural follow-up ("and last
month?") without a ChatMessage table nobody asked for. If you later want
history to survive a cleared session or be visible across devices, that's
the one piece worth promoting into a real model -- everything else here
is fine staying stateless per-request.

Requires:
    pip install google-genai
    settings.GEMINI_API_KEY = "<your key>"   (or GEMINI_API_KEY in the env)
"""
import json
import re

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.http import HttpResponseBadRequest, JsonResponse
from django.shortcuts import get_object_or_404, render
from django.views.decorators.http import require_POST

from google import genai
from google.genai import types

from .prompts import build_system_instruction
from .tools import PERIOD_CHOICES, BusinessTools

# The assistant app expects a sibling "BusinessOs" app with a Business model
# exposing can_record_sales(user) -- adjust this import if your project
# names that app something else.
from BusinessOs.models import Business

# gemini-2.5-flash: fast, cheap, and the most battle-tested model line for
# automatic/manual function calling as of writing. gemini-2.5-pro is a
# drop-in upgrade if you need deeper reasoning on messier questions. Avoid
# pointing this at the 3.5-flash preview line for now -- there's an open,
# reported bug where it can return an empty final answer after a tool
# call completes; not worth the risk for a finance-facing assistant.
MODEL_NAME = "gemini-2.5-flash"

MAX_TOOL_ROUNDS = 4
MAX_HISTORY_TURNS = 12

# Grounding safety net (see _looks_ungrounded below): if the user's
# message smells like a data question and the model's reply contains a
# number WITHOUT having called any tool this turn, that's a guess
# slipping through despite the system prompt -- force a redo.
FINANCE_KEYWORDS = (
    "profit", "revenue", "sale", "sold", "stock", "restock", "owe", "debt",
    "expense", "performance", "money", "faida", "hisa", "deni", "mauzo", "bei",
)
NUMBER_PATTERN = re.compile(r"\d{2,}")


def _client():
    api_key = getattr(settings, "GEMINI_API_KEY", None)
    return genai.Client(api_key=api_key) if api_key else genai.Client()


def _period_schema():
    return types.Schema(
        type=types.Type.STRING,
        enum=PERIOD_CHOICES,
        description=(
            "A named time window: one of "
            + ", ".join(PERIOD_CHOICES)
            + ". Always pick the closest match to what the user asked for -- never supply a literal date."
        ),
    )


def _tool_declarations():
    period = _period_schema()
    limit = lambda desc: types.Schema(type=types.Type.INTEGER, description=desc)  # noqa: E731

    return [types.Tool(function_declarations=[
        types.FunctionDeclaration(
            name="get_profit_summary",
            description=(
                "Revenue, cost of goods sold, expenses, and net profit for a period. "
                "Use for any question about profit, revenue, income, or expenses."
            ),
            parameters=types.Schema(type=types.Type.OBJECT, properties={"period": period}),
        ),
        types.FunctionDeclaration(
            name="get_sales_performance",
            description=(
                "How sales are trending this period vs the immediately preceding period, "
                "plus a daily breakdown. Use for 'how are my sales doing/performing' questions."
            ),
            parameters=types.Schema(type=types.Type.OBJECT, properties={"period": period}),
        ),
        types.FunctionDeclaration(
            name="get_top_selling_products",
            description="Products ranked by how fast they're selling (units per day). Use for 'which products are selling fastest/best'.",
            parameters=types.Schema(type=types.Type.OBJECT, properties={
                "period": period, "limit": limit("How many products to return, default 5."),
            }),
        ),
        types.FunctionDeclaration(
            name="get_slow_moving_products",
            description="Products that sold the least in a period. Use for 'what's not selling / slow-moving stock'.",
            parameters=types.Schema(type=types.Type.OBJECT, properties={
                "period": period, "limit": limit("How many products to return, default 5."),
            }),
        ),
        types.FunctionDeclaration(
            name="get_restock_recommendations",
            description="Products at or below their reorder threshold right now. Use for 'what should I restock / what's running low'.",
            parameters=types.Schema(type=types.Type.OBJECT, properties={}),
        ),
        types.FunctionDeclaration(
            name="get_customers_who_owe_money",
            description="Customers with an outstanding balance, highest first, and the total owed to the business. Use for 'who owes me money / who hasn't paid'.",
            parameters=types.Schema(type=types.Type.OBJECT, properties={
                "limit": limit("How many customers to return, default 15."),
            }),
        ),
        types.FunctionDeclaration(
            name="get_suppliers_you_owe",
            description="Suppliers the business still owes money to, highest first. Use for 'who do I owe / what do I owe suppliers'.",
            parameters=types.Schema(type=types.Type.OBJECT, properties={
                "limit": limit("How many suppliers to return, default 15."),
            }),
        ),
    ])]


def _dispatch(tools_impl, name, args):
    fn = getattr(tools_impl, name, None)
    if fn is None:
        return {"error": f"Unknown tool '{name}'."}
    try:
        return fn(**args)
    except TypeError as exc:
        return {"error": f"Bad arguments for '{name}': {exc}"}


def _looks_ungrounded(user_text: str, reply_text: str, any_tool_called: bool) -> bool:
    if any_tool_called:
        return False
    text = user_text.lower()
    if not any(keyword in text for keyword in FINANCE_KEYWORDS):
        return False
    return bool(NUMBER_PATTERN.search(reply_text))


def run_conversation(business, history, user_message):
    """
    history: list of {"role": "user"|"model", "text": str}, already
    trimmed by the caller.
    Returns (reply_text, tool_calls_made: list[str]).
    """
    client = _client()
    tools_impl = BusinessTools(business)
    system_instruction = build_system_instruction(business)
    declarations = _tool_declarations()

    contents = [
        types.Content(role=turn["role"], parts=[types.Part.from_text(text=turn["text"])])
        for turn in history
    ]
    contents.append(types.Content(role="user", parts=[types.Part.from_text(text=user_message)]))

    def _call(mode):
        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            tools=declarations,
            tool_config=types.ToolConfig(function_calling_config=types.FunctionCallingConfig(mode=mode)),
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
            temperature=0.2,  # low on purpose: this is a financial assistant, not a creative one
        )
        return client.models.generate_content(model=MODEL_NAME, contents=contents, config=config)

    def _consume_calls(response):
        calls = response.function_calls or []
        if not calls:
            return False
        contents.append(types.Content(role="model", parts=response.candidates[0].content.parts))
        response_parts = []
        for call in calls:
            result = _dispatch(tools_impl, call.name, dict(call.args or {}))
            tool_calls_made.append(call.name)
            response_parts.append(types.Part.from_function_response(name=call.name, response={"result": result}))
        contents.append(types.Content(role="user", parts=response_parts))
        return True

    tool_calls_made = []
    response = _call(types.FunctionCallingConfigMode.AUTO)
    for _ in range(MAX_TOOL_ROUNDS):
        if not _consume_calls(response):
            break
        response = _call(types.FunctionCallingConfigMode.AUTO)

    reply_text = response.text or "Samahani, I couldn't put together an answer just now -- please try asking again."

    if _looks_ungrounded(user_message, reply_text, bool(tool_calls_made)):
        # The system prompt said "always use a tool" and the model didn't.
        # Rather than ship an ungrounded number, force one tool call and
        # let it finish the answer from real data.
        response = _call(types.FunctionCallingConfigMode.ANY)
        if _consume_calls(response):
            response = _call(types.FunctionCallingConfigMode.AUTO)
            reply_text = response.text or reply_text

    return reply_text, tool_calls_made


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------

def _business_or_403(request, business_id):
    business = get_object_or_404(Business, pk=business_id)
    if not business.can_record_sales(request.user):
        raise PermissionDenied("You are not authorized for this business.")
    return business


def _history_key(business):
    return f"assistant_history_{business.id}"


@login_required
def chat_page(request, business_id):
    business = _business_or_403(request, business_id)
    display_name = request.user.get_short_name() or request.user.get_username()
    return render(request, "assistant/chat.html", {
        "business": business,
        "user_display_name": display_name,
        "example_questions": [
            "How much profit did I make this month?",
            "Which products are selling fastest?",
            "Who owes me money?",
            "What should I restock?",
            "How are my sales performing?",
        ],
    })


@login_required
@require_POST
def ask(request, business_id):
    business = _business_or_403(request, business_id)

    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return HttpResponseBadRequest("Malformed request.")

    message = (payload.get("message") or "").strip()
    if not message:
        return HttpResponseBadRequest("Message is required.")
    if len(message) > 2000:
        return HttpResponseBadRequest("Message is too long.")

    key = _history_key(business)
    history = request.session.get(key, [])[-MAX_HISTORY_TURNS:]

    try:
        reply_text, tools_used = run_conversation(business, history, message)
    except Exception:
        # A Gemini/network hiccup should never surface as a raw 500 to a
        # shop owner mid-shift. Wire up real logging here (logger.exception)
        # -- swallowing the error is fine for the USER, not for you.
        return JsonResponse({
            "reply": "Samahani, I couldn't reach the assistant service just now. Please try again in a moment.",
            "tools_used": [], "error": True,
        })

    history.append({"role": "user", "text": message})
    history.append({"role": "model", "text": reply_text})
    request.session[key] = history[-MAX_HISTORY_TURNS:]

    return JsonResponse({"reply": reply_text, "tools_used": tools_used, "error": False})


@login_required
@require_POST
def reset_conversation(request, business_id):
    business = _business_or_403(request, business_id)
    request.session.pop(_history_key(business), None)
    return JsonResponse({"ok": True})