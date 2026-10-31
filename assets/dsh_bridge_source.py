from __future__ import annotations

import json
import os
import uuid
from pathlib import Path
from typing import Any, AsyncGenerator, Literal

import httpx

from astrbot import logger
from astrbot.api.provider import Provider
from astrbot.core.provider.entities import LLMResponse, ToolCallsResult
from astrbot.core.provider.register import register_provider_adapter
from astrbot.core.agent.tool import ToolSet


def _token_from_default_path() -> str:
    try:
        return (Path.home() / ".dsh" / "qq-bridge-token.txt").read_text(encoding="utf-8").strip()
    except Exception:
        return ""


def _message_to_dict(item: Any) -> dict[str, Any]:
    if item is None:
        return {}
    if isinstance(item, dict):
        return item
    if hasattr(item, "model_dump"):
        try:
            return item.model_dump()
        except Exception:
            pass
    return {"role": "user", "content": str(item)}


def _content_to_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return str(content or "")
    parts: list[str] = []
    for part in content:
        if not isinstance(part, dict):
            parts.append(str(part))
            continue
        if part.get("type") == "text":
            parts.append(str(part.get("text") or ""))
        elif part.get("type") == "image_url":
            parts.append("[图片]")
        elif part.get("type") == "audio_url":
            parts.append("[音频]")
    return "\n".join(p for p in parts if p)



def _tool_schemas(func_tool: Any) -> list[dict[str, Any]]:
    tools: list[dict[str, Any]] = []
    raw_tools = getattr(func_tool, "tools", None) if func_tool is not None else None
    for tool in raw_tools or []:
        try:
            if getattr(tool, "active", True) is False:
                continue
            name = str(getattr(tool, "name", ""))
            if name.startswith(("astrbot_execute_", "astrbot_shell_", "astrbot_file_", "astrbot_computer_")):
                continue
            tools.append({
                "name": name,
                "description": str(getattr(tool, "description", "") or ""),
                "parameters": getattr(tool, "parameters", None) or {"type": "object", "properties": {}},
            })
        except Exception:
            continue
    return tools


def _tool_instruction(tools: list[dict[str, Any]]) -> str:
    if not tools:
        return ""
    names = {item["name"] for item in tools}
    return (
        "\n\n[AstrBot tool gateway]\n"
        "You are the reasoning backend for an AstrBot QQ agent. The following AstrBot tools are available.\n"
        "If you need a tool, reply with ONLY one JSON object in this exact shape:\n"
        '{"astrbot_tool_call":{"name":"tool_name","arguments":{}}}\n'
        "Do not wrap the JSON in markdown. Call at most one tool per turn. "
        "If no tool is needed, reply normally. Never invent a tool name.\n"
        "Available tools:\n" + json.dumps(tools, ensure_ascii=False)
        + "\nAllowed tool names: " + ", ".join(sorted(names))
    )


def _tool_result_text(tool_calls_result: Any) -> str:
    if not tool_calls_result:
        return ""
    items = tool_calls_result if isinstance(tool_calls_result, list) else [tool_calls_result]
    blocks: list[Any] = []
    for item in items:
        try:
            if hasattr(item, "to_openai_messages"):
                blocks.extend(item.to_openai_messages())
            elif isinstance(item, dict):
                blocks.append(item)
            else:
                blocks.append(str(item))
        except Exception:
            blocks.append(str(item))
    try:
        return json.dumps(blocks, ensure_ascii=False, default=str)
    except Exception:
        return str(blocks)


def _parse_tool_reply(reply: str, tools: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not tools or not reply:
        return None
    names = {item["name"] for item in tools}
    text = reply.strip()
    start, end = text.find("{"), text.rfind("}")
    candidates = [text]
    if start >= 0 and end > start:
        candidates.append(text[start:end + 1])
    for candidate in candidates:
        try:
            obj = json.loads(candidate)
        except Exception:
            continue
        call = obj.get("astrbot_tool_call") if isinstance(obj, dict) else None
        if not call and isinstance(obj, dict):
            call = obj.get("tool_call") or obj.get("tool")
        if not isinstance(call, dict):
            continue
        name = str(call.get("name") or "").strip()
        if name not in names:
            continue
        args = call.get("arguments", call.get("args", {}))
        if isinstance(args, str):
            try:
                args = json.loads(args)
            except Exception:
                args = {}
        if not isinstance(args, dict):
            args = {}
        return {"name": name, "arguments": args}
    return None

@register_provider_adapter(
    "dsh_bridge",
    "DeepSeek Harness local bridge provider",
    provider_display_name="DSH",
    default_config_tmpl={
        "id": "dsh",
        "type": "dsh_bridge",
        "provider_type": "chat_completion",
        "api_base": "http://127.0.0.1:18081",
        "model": "dsh",
        "timeout": 390,
        "token": "",
        "enable": True,
    },
)
class ProviderDSHBridge(Provider):
    """AstrBot provider that forwards the assembled request to DSH."""

    def __init__(self, provider_config: dict, provider_settings: dict) -> None:
        super().__init__(provider_config, provider_settings)
        self.api_base = str(provider_config.get("api_base") or "http://127.0.0.1:18081").rstrip("/")
        self.bridge_token = str(provider_config.get("token") or "").strip() or _token_from_default_path()
        self.timeout = float(provider_config.get("timeout") or 390)
        self.model_name = str(provider_config.get("model") or "dsh")

    def get_current_key(self) -> str:
        return "dsh"

    def set_key(self, key: str) -> None:
        self.bridge_token = str(key or "").strip()

    async def get_models(self) -> list[str]:
        return ["dsh"]

    async def text_chat(
        self,
        prompt: str | None = None,
        session_id: str | None = None,
        image_urls: list[str] | None = None,
        audio_urls: list[str] | None = None,
        func_tool: ToolSet | None = None,
        contexts: list[dict] | list[Any] | None = None,
        system_prompt: str | None = None,
        tool_calls_result: ToolCallsResult | list[ToolCallsResult] | None = None,
        model: str | None = None,
        extra_user_content_parts: list[Any] | None = None,
        tool_choice: Literal["auto", "required"] = "auto",
        request_max_retries: int | None = None,
        **kwargs: Any,
    ) -> LLMResponse:
        normalized_contexts = [_message_to_dict(item) for item in (contexts or [])]
        extra_text = "\n".join(_content_to_text(item) for item in (extra_user_content_parts or []))
        tools = _tool_schemas(func_tool)
        tool_result = _tool_result_text(tool_calls_result)
        effective_system_prompt = system_prompt or ""
        if tools:
            effective_system_prompt += _tool_instruction(tools)
        effective_prompt = prompt or ""
        if tool_result:
            effective_prompt += "\n\n[Tool execution results]\n" + tool_result
        payload = {
            "sessionId": session_id or "",
            "systemPrompt": effective_system_prompt,
            "contexts": normalized_contexts,
            "prompt": effective_prompt,
            "extraUserContent": extra_text,
            "images": image_urls or [],
            "tools": tools,
        }
        headers = {"Authorization": "Bearer " + self.bridge_token} if self.bridge_token else {}
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(self.api_base + "/provider_chat", json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            reply = str(data.get("reply") or "").strip()
            if not reply:
                raise RuntimeError("DSH provider returned an empty reply")
            tool_call = _parse_tool_reply(reply, tools)
            if tool_call:
                return LLMResponse(
                    "assistant",
                    tools_call_name=[tool_call["name"]],
                    tools_call_args=[tool_call["arguments"]],
                    tools_call_ids=[uuid.uuid4().hex],
                )
            return LLMResponse("assistant", completion_text=reply)
        except Exception as exc:
            logger.error("[DSH Provider] request failed: %s", exc)
            raise

    async def text_chat_stream(self, *args: Any, **kwargs: Any) -> AsyncGenerator[LLMResponse, None]:
        response = await self.text_chat(*args, **kwargs)
        yield response
