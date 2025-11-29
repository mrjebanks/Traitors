from __future__ import annotations

from typing import Set

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

app = FastAPI()
templates = Jinja2Templates(directory="templates")


class DisplayManager:
    """Tracks display websocket connections so we can broadcast updates."""

    def __init__(self) -> None:
        self.displays: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.displays.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self.displays.discard(websocket)

    async def broadcast_claim(self, name: str) -> None:
        message = {"type": "claimed", "name": name}
        dead_connections: Set[WebSocket] = set()
        for display in self.displays:
            try:
                await display.send_json(message)
            except Exception:
                dead_connections.add(display)
        for dead in dead_connections:
            self.disconnect(dead)

    async def broadcast_reset(self) -> None:
        message = {"type": "reset"}
        dead_connections: Set[WebSocket] = set()
        for display in self.displays:
            try:
                await display.send_json(message)
            except Exception:
                dead_connections.add(display)
        for dead in dead_connections:
            self.disconnect(dead)

    async def send_status(self, websocket: WebSocket, claimed_name: str | None) -> None:
        await websocket.send_json({"type": "status", "name": claimed_name})


manager = DisplayManager()
claimed_name: str | None = None

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", response_class=HTMLResponse)
async def display_screen(request: Request) -> HTMLResponse:
    return templates.TemplateResponse("display.html", {"request": request})


@app.get("/join", response_class=HTMLResponse)
async def join_screen(request: Request) -> HTMLResponse:
    return templates.TemplateResponse("join.html", {"request": request})


@app.get("/status")
async def status() -> JSONResponse:
    return JSONResponse({"claimed": claimed_name is not None, "name": claimed_name})


@app.post("/claim")
async def claim_shield(payload: dict) -> JSONResponse:
    global claimed_name
    if claimed_name:
        raise HTTPException(status_code=409, detail=f"Shield already triggered by {claimed_name}.")

    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")

    claimed_name = name
    await manager.broadcast_claim(name)
    return JSONResponse({"ok": True, "name": name})


@app.post("/reset")
async def reset_state() -> JSONResponse:
    """Reset the claimed name (single-use state)."""
    global claimed_name
    claimed_name = None
    await manager.broadcast_reset()
    return JSONResponse({"ok": True})


@app.websocket("/ws/display")
async def display_ws(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        await manager.send_status(websocket, claimed_name)
        while True:
            # Keep the connection alive; incoming messages are ignored for now.
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
