from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Any

from astrbot.api import logger
from astrbot.api.event import MessageChain
from astrbot.api.star import Context, Star, register


PLUGIN_NAME = "astrbot_plugin_dsh_gateway"


def _bridge_token() -> str:
    try:
        return (Path.home() / ".dsh" / "qq-bridge-token.txt").read_text(encoding="utf-8").strip()
    except Exception:
        return ""


@register(PLUGIN_NAME, "DSH AstriaX Native", "Local outbound gateway for DSH", "0.1.0")
class DshGatewayPlugin(Star):
    def __init__(self, context: Context, config=None) -> None:
        super().__init__(context)
        self.port = int(os.environ.get("DSH_GATEWAY_PORT", "18082"))
        self._server: asyncio.AbstractServer | None = None

    async def initialize(self) -> None:
        if self._server is not None:
            return
        self._server = await asyncio.start_server(self._handle_client, "127.0.0.1", self.port)
        logger.info("[DSH Gateway] listening on 127.0.0.1:%s", self.port)

    async def terminate(self) -> None:
        if self._server is not None:
            self._server.close()
            await self._server.wait_closed()
            self._server = None

    async def _handle_client(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        status = 200
        payload: dict[str, Any] = {"ok": False}
        try:
            head = await reader.readuntil(b"\r\n\r\n")
            lines = head.decode("latin-1").split("\r\n")
            method, path, _ = (lines[0].split(" ", 2) + ["", ""])[:3]
            headers: dict[str, str] = {}
            for line in lines[1:]:
                if ":" in line:
                    key, value = line.split(":", 1)
                    headers[key.strip().lower()] = value.strip()
            length = int(headers.get("content-length", "0") or 0)
            body = await reader.readexactly(length) if length else b""
            if path == "/status" and method == "GET":
                payload = {"ok": True, "plugin": PLUGIN_NAME, "port": self.port}
            elif path == "/send" and method == "POST":
                expected = _bridge_token()
                supplied = headers.get("x-dsh-gateway-token", "")
                if not expected or supplied != expected:
                    status = 403
                    payload = {"ok": False, "error": "unauthorized"}
                else:
                    data = json.loads(body.decode("utf-8") or "{}")
                    session = str(data.get("session") or "").strip()
                    text = str(data.get("text") or "").strip()
                    if not session or not text:
                        status = 400
                        payload = {"ok": False, "error": "session and text are required"}
                    else:
                        sent = await self.context.send_message(session, MessageChain().message(text))
                        logger.info("[DSH Gateway] send session=%s ok=%s", session, sent)
                        payload = {"ok": bool(sent), "session": session}
            else:
                status = 404
                payload = {"ok": False, "error": "not found"}
        except Exception as exc:
            status = 500
            payload = {"ok": False, "error": str(exc)}
            logger.exception("[DSH Gateway] request failed: %s", exc)
        finally:
            data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            reason = "OK" if status == 200 else "ERROR"
            writer.write(
                f"HTTP/1.1 {status} {reason}\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: {len(data)}\r\nConnection: close\r\n\r\n".encode("latin-1")
                + data
            )
            try:
                await writer.drain()
            except Exception:
                pass
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                pass
