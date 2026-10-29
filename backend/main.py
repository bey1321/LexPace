"""LexPace in Blackboard: demo backend.

- /api/...                 small JSON API backed by data/demo.json
- /api/screening/...       adaptive EN/AR screening (LLM item generation, evaluation, features, classifier)
- /lexpace/...             screening + adaptation, served as static files (copies of the originals)
- /lexpace/training/...    reverse proxy to the training app's own Node server
- /api/sas/student/...     pass-through to the SAS Portal (student side only: My SAS requests)
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

from screening.router import create_router as create_screening_router

HERE = Path(__file__).resolve().parent
DATA_FILE = HERE / "data" / "demo.json"
LEXPACE_DIR = HERE / "static" / "lexpace"
DIST_DIR = HERE.parent / "frontend" / "dist"
TRAINING_URL = os.environ.get("TRAINING_URL", "http://127.0.0.1:3000")
# The SAS Portal runs on its own (sas-portal/, port 8010). Students reach it only through /api/sas/student/...
SAS_URL = os.environ.get("SAS_URL", "http://127.0.0.1:8010")

# Lesson versions of adaptation.html (its localStorage key "pl2-prof" uses the same ids).
# Only skill flags and the chosen version are stored, never a condition label.
VERSIONS = {
    "base": "Base lesson",
    "read": "Reading support",
    "write": "Writing support",
    "calc": "Calculation support",
}
VersionId = Literal["base", "read", "write", "calc"]

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


def support_view(s: Optional[dict]) -> dict:
    if not s or s.get("version") not in VERSIONS:
        return {"version": None, "label": None, "skills": None, "source": None, "updatedAt": None}
    return {**s, "label": VERSIONS[s["version"]]}


@app.get("/api/lexpace/profile")
def get_profile():
    return support_view(load_data().get("lexpaceSupport"))


class Skills(BaseModel):
    reading: bool = False
    writing: bool = False
    math: bool = False


class SupportIn(BaseModel):
    version: Optional[VersionId]
    skills: Optional[Skills] = None  # sent by the screening; a manual pick has no flags
    source: str = "manual"


@app.post("/api/lexpace/profile")
def set_profile(body: SupportIn):
    with _lock:
        data = load_data()
        data["lexpaceSupport"] = None if body.version is None else {
            "version": body.version,
            "skills": body.skills.model_dump() if body.skills else None,
            "source": body.source,
            "updatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }
        data.pop("lexpaceProfile", None)  # old five-profile key
        save_data(data)
    return support_view(data["lexpaceSupport"])


# ---------------------------------------------------------------- adaptive screening (EN/AR games)

VERSION_FOR_LABEL = {"reading": "read", "writing": "write", "math": "calc"}


def save_check_summary(classification: dict) -> None:
    """Keeps only what the student may later choose to share: three yes/no results, or "pending"."""
    ok = classification.get("status") == "ok"
    outputs = classification.get("outputs") or {}
    summary = {"status": "ok" if ok else "pending",
               "at": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    if ok:
        summary.update({k: bool(outputs.get(k, {}).get("positive")) for k in VERSION_FOR_LABEL})
    with _lock:
        data = load_data()
        data["lexpaceCheck"] = summary
        save_data(data)


@app.get("/api/lexpace/check")
def get_check():
    """The latest check result in plain terms, or {"status": null} if the student hasn't taken it."""
    return load_data().get("lexpaceCheck") or {"status": None}


def save_screening_result(classification: dict) -> None:
    """Trained model outputs -> skill flags + lesson version.
    One positive output picks its version; several pick the highest probability; none -> base.
    Without model outputs the student gets the base lesson (marked pending), unless they already
    have a version, which is kept.
    TODO(stacking): combine supports once the lecture page can show more than one."""
    save_check_summary(classification)
    if classification.get("status") != "ok":
        if get_profile()["version"] is None:
            set_profile(SupportIn(version="base", source="screening_pending"))
        return
    outputs = classification.get("outputs") or {}
    skills = {label: bool(outputs.get(label, {}).get("positive")) for label in VERSION_FOR_LABEL}
    positive = [l for l in VERSION_FOR_LABEL if skills[l]]
    version = VERSION_FOR_LABEL[max(positive, key=lambda l: outputs[l]["probability"])] if positive else "base"
    set_profile(SupportIn(version=version, skills=Skills(**{"reading": skills["reading"], "writing": skills["writing"],
                                                             "math": skills["math"]}), source="screening"))


app.include_router(create_screening_router(on_result=save_screening_result))


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


# ---------------------------------------------------------------- SAS Portal (student side)

@app.api_route("/api/sas/student/{path:path}", methods=["GET", "POST"])
async def sas_student(request: Request, path: str):
    """Only the student routes are forwarded; staff routes stay on the SAS Portal itself."""
    body = await request.body()
    if request.method == "POST" and path == "requests":
        try:
            form = json.loads(body or b"{}")
        except ValueError:
            form = {}
        check = load_data().get("lexpaceCheck") or {"status": "pending"}
        form["results"] = {k: check[k] for k in ("status", "reading", "writing", "math") if k in check}
        body = json.dumps(form).encode()
    try:
        async with httpx.AsyncClient(base_url=SAS_URL, timeout=15.0) as client:
            r = await client.request(request.method, f"/api/sas/student/{path}", params=request.query_params,
                                     content=body,
                                     headers={"content-type": request.headers.get("content-type", "application/json")})
    except httpx.TransportError:
        return Response('{"detail": "SAS is not reachable right now. Please try again later."}',
                        status_code=503, media_type="application/json")
    return Response(r.content, status_code=r.status_code, media_type="application/json")


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
