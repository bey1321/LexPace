"""LexPace in Blackboard: demo backend.

- /api/...                 small JSON API backed by data/demo.json
- /lexpace/...             screening + adaptation, served as static files (copies of the originals)
- /lexpace/training/...    reverse proxy to the training app's own Node server
- /api/rap, /rap, /dev/login, /internal/rap
                           also proxied: the training app uses these absolute paths
- everything else          the built React shell (frontend/dist), with SPA fallback
"""

import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Optional

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

HERE = Path(__file__).resolve().parent
DATA_FILE = HERE / "data" / "demo.json"
LEXPACE_DIR = HERE / "static" / "lexpace"
DIST_DIR = HERE.parent / "frontend" / "dist"
TRAINING_URL = os.environ.get("TRAINING_URL", "http://127.0.0.1:3000")

PROFILES = {
    "base": "Base lesson",
    "phon": "Phonological",
    "surf": "Surface",
    "rapid": "Rapid naming",
    "double": "Double deficit",
    "mixed": "Mixed",
}

app = FastAPI(title="LexPace in Blackboard (demo)")
_lock = threading.Lock()


def load_data() -> dict:
    with DATA_FILE.open(encoding="utf-8") as f:
        return json.load(f)


def save_data(data: dict) -> None:
    tmp = DATA_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(DATA_FILE)


# ---------------------------------------------------------------- JSON API

@app.get("/api/me")
def me():
    return load_data()["me"]


@app.get("/api/courses")
def courses():
    return load_data()["courses"]


@app.get("/api/courses/{course_id}/content")
def course_content(course_id: str):
    content = load_data()["content"].get(course_id)
    if content is None:
        raise HTTPException(404, "Unknown course")
    return content


@app.get("/api/lexpace/materials")
def materials():
    return load_data()["materials"]


def profile_view(p: Optional[dict]) -> dict:
    if not p:
        return {"profile": None, "label": None, "source": None, "updatedAt": None}
    return {**p, "label": PROFILES[p["profile"]]}


@app.get("/api/lexpace/profile")
def get_profile():
    return profile_view(load_data().get("lexpaceProfile"))


class ProfileIn(BaseModel):
    profile: Optional[Literal["base", "phon", "surf", "rapid", "double", "mixed"]]
    source: str = "manual"


@app.post("/api/lexpace/profile")
def set_profile(body: ProfileIn):
    with _lock:
        data = load_data()
        data["lexpaceProfile"] = None if body.profile is None else {
            "profile": body.profile,
            "source": body.source,
            "updatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }
        save_data(data)
    return profile_view(data["lexpaceProfile"])


# ---------------------------------------------------------------- training proxy

HOP_HEADERS = {
    "host", "connection", "keep-alive", "transfer-encoding", "content-length",
    "content-encoding", "accept-encoding", "upgrade", "proxy-connection",
}
# Colour override for the training app, injected into its HTML so its own files stay untouched.
TRAINING_CSS = '<link rel="stylesheet" href="/theme.css"><link rel="stylesheet" href="/lexpace/bb-overrides/training.css">'
_client: Optional[httpx.AsyncClient] = None


@app.on_event("startup")
async def _startup():
    global _client
    _client = httpx.AsyncClient(base_url=TRAINING_URL, timeout=30.0)


@app.on_event("shutdown")
async def _shutdown():
    if _client:
        await _client.aclose()


async def proxy(request: Request, upstream_path: str) -> Response:
    headers = {k: v for k, v in request.headers.items() if k.lower() not in HOP_HEADERS}
    try:
        r = await _client.request(
            request.method, upstream_path, params=request.query_params,
            headers=headers, content=await request.body(),
        )
    except httpx.TransportError:
        return HTMLResponse(
            "<body style='font:18px Arial,sans-serif;padding:32px;color:#262626'>"
            "<h1 style='font-size:24px'>LexPace Training is not running</h1>"
            f"<p>Start it with <code>npm start</code> in <code>Training/LexPace</code> (expected at {TRAINING_URL}).</p></body>",
            status_code=503,
        )
    body = r.content
    if r.headers.get("content-type", "").startswith("text/html"):
        html = r.text
        html = html.replace("</head>", TRAINING_CSS + "</head>", 1) if "</head>" in html else TRAINING_CSS + html
        body = html.encode("utf-8")
    resp = Response(content=body, status_code=r.status_code)
    for k, v in r.headers.multi_items():
        if k.lower() not in HOP_HEADERS:
            resp.headers.append(k, v)
    return resp


METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"]


@app.get("/lexpace/training")
def training_slash():
    return RedirectResponse("/lexpace/training/")


@app.api_route("/lexpace/training/{path:path}", methods=METHODS)
async def training(request: Request, path: str):
    return await proxy(request, "/" + path)


@app.api_route("/api/rap/{path:path}", methods=METHODS)
async def training_api(request: Request, path: str):
    return await proxy(request, "/api/rap/" + path)


@app.api_route("/internal/rap/{path:path}", methods=METHODS)
async def training_internal(request: Request, path: str):
    return await proxy(request, "/internal/rap/" + path)


@app.api_route("/rap/{path:path}", methods=METHODS)
async def training_pages(request: Request, path: str):
    return await proxy(request, "/rap/" + path)


@app.get("/dev/login")
async def training_login(request: Request):
    return await proxy(request, "/dev/login")


# ---------------------------------------------------------------- static parts + SPA

app.mount("/lexpace", StaticFiles(directory=LEXPACE_DIR, html=True), name="lexpace")


@app.get("/api/{path:path}")
def api_404(path: str):
    raise HTTPException(404, "Unknown API path")


@app.get("/{path:path}")
def spa(path: str):
    index = DIST_DIR / "index.html"
    if not index.exists():
        return HTMLResponse("Frontend not built. Run <code>npm run build</code> in <code>frontend/</code>.", 503)
    target = (DIST_DIR / path).resolve()
    if path and target.is_file() and target.is_relative_to(DIST_DIR):
        return FileResponse(target)
    return FileResponse(index)
