"""Thin async wrapper around the Claude API. Backend only: the key never reaches the browser.

Every call asks for JSON that matches a schema (structured outputs), then the caller
validates the content again in Python. Any failure raises LLMError, and the caller
falls back to the validated starter items.
"""

import json
import logging
from typing import Any

import anthropic

from . import config

log = logging.getLogger("lexpace.llm")


class LLMError(Exception):
    pass


_client: anthropic.AsyncAnthropic | None = None
last_error: str | None = None


def enabled() -> bool:
    return config.LLM_ENABLED


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(timeout=config.LLM_TIMEOUT_S, max_retries=1)
    return _client


def obj(properties: dict, required: list[str] | None = None) -> dict:
    """JSON-schema object for structured outputs (closed, every field required)."""
    return {"type": "object", "properties": properties,
            "required": required if required is not None else list(properties), "additionalProperties": False}


async def generate_json(system: str, prompt: str, schema: dict, *, effort: str = "low", max_tokens: int = 4000) -> dict[str, Any]:
    """One structured-output request. Returns the parsed JSON object or raises LLMError."""
    global last_error
    if not enabled():
        raise LLMError("LLM not configured")
    kwargs: dict[str, Any] = dict(
        model=config.LLM_MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": prompt}],
        output_config={"effort": effort, "format": {"type": "json_schema", "schema": schema}},
    )
    if config.LLM_FALLBACKS:
        kwargs.update(betas=["server-side-fallback-2026-07-01"], fallbacks="default")
    try:
        response = await _get_client().beta.messages.create(**kwargs)
    except anthropic.AuthenticationError as e:
        last_error = "authentication failed"
        raise LLMError(last_error) from e
    except anthropic.RateLimitError as e:
        last_error = "rate limited"
        raise LLMError(last_error) from e
    except anthropic.BadRequestError as e:
        last_error = f"bad request: {e.message}"
        raise LLMError(last_error) from e
    except anthropic.APIStatusError as e:
        last_error = f"API error {e.status_code}"
        raise LLMError(last_error) from e
    except anthropic.APIConnectionError as e:  # includes timeouts
        last_error = "connection error or timeout"
        raise LLMError(last_error) from e

    if response.stop_reason == "refusal":
        last_error = "request declined"
        raise LLMError(last_error)
    if response.stop_reason == "max_tokens":
        last_error = "output truncated"
        raise LLMError(last_error)
    text = next((b.text for b in response.content if b.type == "text"), None)
    if not text:
        last_error = "empty response"
        raise LLMError(last_error)
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        last_error = "invalid JSON"
        raise LLMError(last_error) from e
    if not isinstance(data, dict):
        last_error = "JSON is not an object"
        raise LLMError(last_error)
    last_error = None
    return data
