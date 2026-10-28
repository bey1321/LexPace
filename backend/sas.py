"""SAS Portal: the staff side where Student Accessibility Services handles support requests.

- Campus manager (mgr): assigns, reassigns, adds notes, sees workload, resolves concerns. Never decides.
- Specialists (ld1, ld2, acc1): see only their own cases, decide (with a reason) and close. Can't assign.

Demo identity: the X-Demo-User header. Production would use university login.
Data: data/sas.json (one lock, atomic save, like demo.json). Created from the seed on first use.
Rules: advisory only (no diagnosis words, no ranking), one owner after assignment, a reason for
every decision, nothing but the shared fields reaches SAS, everything goes on the case timeline.
"""

import json
import os
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable, Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field

DATA_FILE = Path(os.environ.get("SAS_DATA_FILE") or Path(__file__).resolve().parent / "data" / "sas.json")
UAE = timezone(timedelta(hours=4))
_lock = threading.Lock()
_clock: Optional[Callable[[], datetime]] = None  # tests can fix "now"

TEAM = {
    "mgr": {"name": "Ms. Rana Haddad", "role": "Campus Manager", "canOwn": False},
    "ld1": {"name": "Ms. Noor Saleh", "role": "Learning Disability Specialist", "canOwn": True},
    "ld2": {"name": "Ms. Aisha Karim", "role": "Learning Disability Specialist", "canOwn": True},
    "acc1": {"name": "Ms. Lina Yousef", "role": "Accessibility Specialist", "canOwn": True},
}
SERVICES = [
    "Academic Support Tutor (SAS)", "Accessibility Technology Specialist (SAS)",
    "Writing Centre", "English language support", "Counselling", "Academic advising",
]
CHOICES = ["Meeting with SAS", "Full assessment", "SAS or university service", "Not a learning disability concern"]
NOT_LD = "Not a learning disability concern"
AREAS = ["Word reading", "Reading speed", "Understanding", "Spelling"]
LABEL = "Advisory only · not a diagnosis"


# ---------------------------------------------------------------- time

def now() -> datetime:
    return _clock() if _clock else datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def day(s: str) -> str:
    """'24 Oct' in UAE time."""
    d = parse(s).astimezone(UAE)
    return f"{d.day} {d.strftime('%b')}"


def add_working_days(start: datetime, n: int) -> datetime:
    """Mon to Fri, UAE time. Friday + 1 is Monday."""
    d = start.astimezone(UAE)
    while n > 0:
        d += timedelta(days=1)
        if d.weekday() < 5:
            n -= 1
    return d.astimezone(timezone.utc)


# ---------------------------------------------------------------- advisory text (rule-based)

def summary(areas: dict) -> str:
    extra = [k.lower() for k in AREAS if areas.get(k)]
    if not extra:
        return "All areas are typical."
    text = " and ".join(extra)
    return f"{text[0].upper() + text[1:]} take{'s' if len(extra) == 1 else ''} extra effort. Other areas are typical."


def history_label(score: Optional[float]) -> str:
    if score is None:
        return "Not shared"
    return "Hard since school" if score >= 0.47 else "Some difficulty" if score >= 0.25 else "No difficulty"


def consider_text(areas: dict, years: str) -> str:
    if areas.get("Understanding") and years == "0-3":
        return "Understanding takes extra effort and few years in English. Check English level first."
    return ""


# ---------------------------------------------------------------- seed (the reference data)

def build_seed() -> dict:
    t = now()

    def req(rid, days_ago, rtype, status, owner, student, contact, language, areas, history, note,
            consider="", decision=None, closed=None, events=()):
        created = t - timedelta(days=days_ago)
        timeline = [{"at": iso(created), "text": "Request received (student consented)"}]
        timeline += [{"at": iso(created + timedelta(days=d)), "text": text} for d, text in events]
        return {
            "id": rid, "studentId": f"demo-{rid.lower()}", "type": rtype,
            "createdAt": iso(created), "dueAt": iso(add_working_days(created, 2)),
            "status": status, "owner": owner, "student": student, "contact": contact, "language": language,
            "areas": dict(zip(AREAS, areas)), "history": history, "note": note, "consider": consider,
            "decision": decision, "closed": closed, "messages": [], "timeline": timeline,
        }

    requests = [
        req("R-104", 5, "Full check", "new", None, "Mariam A.", "Email · online · extra time",
            "Arabic first · 9+ yrs English", [False, True, False, True], "Hard since school",
            "I always run out of time in exams and reread chapters many times."),
        req("R-103", 1, "Informal talk", "new", None, "Omar K.", "Phone · in person",
            "Other language · 0–3 yrs English", [False, True, True, False], "Some difficulty",
            "Long English readings take me a very long time.",
            consider="Listening is also low and few years in English. Check English level first."),
        req("R-101", 1, "Full check", "assigned", "ld1", "Layla H.", "Email · online", "English first",
            [True, True, False, True], "Hard since school", "Spelling and reading new words has always been hard.",
            events=[(0, "Assigned to Ms. Noor Saleh by Ms. Rana Haddad")]),
        req("R-099", 4, "Informal talk", "waiting", "ld1", "Hessa S.", "Email · online",
            "Arabic first · 9+ yrs English", [True, True, False, False], "Some difficulty",
            "Is extra exam time possible?",
            decision={"choice": "Meeting with SAS", "reason": "Discuss exam needs first.", "by": "ld1",
                      "message": "Hi Hessa, thank you for reaching out. Could we meet this week to talk about exam time?",
                      "response": None},
            events=[(0, "Assigned to Ms. Noor Saleh"), (2, "Decision sent: Meeting with SAS")]),
        req("R-097", 5, "Full check", "progress", "ld2", "Yusuf M.", "Email · in person",
            "Arabic first · 4–8 yrs English", [False, False, False, True], "Some difficulty",
            "My spelling loses me marks in every essay.",
            decision={"choice": "Full assessment", "reason": "Persistent spelling difficulty since school.",
                      "by": "ld2", "message": "Hi Yusuf, we suggest a full assessment. It is free and private.",
                      "response": "Accepted"},
            events=[(0, "Assigned to Ms. Aisha Karim"), (1, "Decision sent: Full assessment"), (2, "Student accepted")]),
        req("R-093", 8, "Informal talk", "closed", "ld1", "Fatima R.", "Email", "Arabic first · 4–8 yrs English",
            [False, False, False, False], "No difficulty", "I struggle to organise long essays.",
            closed="Not a learning disability concern · suggested Writing Centre",
            events=[(2, "Closed: suggested Writing Centre")]),
    ]
    return {
        "requests": requests,
        "questions": [
            {"id": "Q-31", "text": "If I ask SAS for help, will my teachers find out?", "reply": ""},
            {"id": "Q-30", "text": "Can I get extra exam time without an assessment?", "reply": ""},
        ],
        "concerns": [
            {"id": "C-4", "case": "R-099", "text": "I haven't heard back about the meeting time I asked for.", "done": False},
        ],
        "outbox": [],
    }


# ---------------------------------------------------------------- store

def _write(data: dict) -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = DATA_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(DATA_FILE)


def _read() -> dict:
    if not DATA_FILE.exists():
        _write(build_seed())
    with DATA_FILE.open(encoding="utf-8") as f:
        return json.load(f)


class _Tx:
    """with tx() as data: ...  reads, changes and saves under one lock."""
    def __enter__(self):
        _lock.acquire()
        try:
            self.data = _read()
        except Exception:
            _lock.release()
            raise
        return self.data

    def __exit__(self, exc_type, *_):
        try:
            if exc_type is None:
                _write(self.data)
        finally:
            _lock.release()


def tx():
    return _Tx()


def read() -> dict:
    with _lock:
        return _read()


def log(r: dict, text: str) -> None:
    r["timeline"].append({"at": iso(now()), "text": text})


def next_id(items, prefix):
    nums = [int(i["id"].split("-")[1]) for i in items if i["id"].startswith(prefix + "-")]
    return f"{prefix}-{max(nums, default=100) + 1}"


# ---------------------------------------------------------------- views

def overdue(r) -> bool:
    return r["status"] == "new" and now() > parse(r["dueAt"])


def staff_view(r: dict) -> dict:
    """What the portal shows. Same shape as the reference page."""
    return {
        "id": r["id"], "type": r["type"], "received": day(r["createdAt"]), "due": day(r["dueAt"]),
        "overdue": overdue(r), "status": r["status"], "owner": r["owner"], "student": r["student"],
        "contact": r["contact"], "language": r["language"], "areas": r["areas"], "history": r["history"],
        "note": r["note"] or "", "consider": r["consider"], "summary": summary(r["areas"]), "label": LABEL,
        "decision": r["decision"], "closed": r["closed"],
        "timeline": [f"{day(e['at'])} · {e['text']}" for e in r["timeline"]],
    }


def student_view(r: dict) -> dict:
    d = r["decision"]
    return {
        "id": r["id"], "type": r["type"], "status": r["status"], "received": day(r["createdAt"]),
        "ownerName": TEAM[r["owner"]]["name"] if r["owner"] else None,
        "message": d["message"] if d else None, "decision": d["choice"] if d else None,
        "response": d["response"] if d else None, "closed": r["closed"],
    }


# ---------------------------------------------------------------- models

class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")  # unknown fields (raw answers, timings) are refused


class AssignIn(BaseModel):
    owner: str


class TextIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class DecideIn(BaseModel):
    choice: Literal["Meeting with SAS", "Full assessment", "SAS or university service", "Not a learning disability concern"]
    service: Optional[str] = None
    reason: str = Field("", max_length=2000)
    message: str = Field("", max_length=4000)


class CloseIn(BaseModel):
    reason: str = Field("", max_length=500)


class ReplyIn(BaseModel):
    response: Literal["Accepted", "Not now"]


class Flags(Strict):
    soundWeak: bool = False
    slow: bool = False
    understood: bool = True
    spellingWeak: bool = False


class ScreeningIn(Strict):
    flags: Flags
    history: Optional[float] = Field(None, ge=0, le=1)


class LanguageIn(Strict):
    first: Literal["English", "Arabic", "Other"]
    years: Literal["0-3", "4-8", "9+"]


class StudentRequestIn(Strict):
    type: Literal["Informal talk", "Full check"]
    contact: Literal["Email", "Phone"] = "Email"
    format: Literal["Online", "In person"] = "Online"
    needs: str = Field("", max_length=200)
    language: LanguageIn
    note: str = Field("", max_length=500)
    screening: ScreeningIn


class ConcernIn(BaseModel):
    requestId: str
    text: str = Field(min_length=1, max_length=2000)


# ---------------------------------------------------------------- router

def create_router(get_me: Callable[[], dict]) -> APIRouter:
    router = APIRouter(prefix="/api/sas")

    def staff(x_demo_user: Optional[str] = Header(None)):
        if x_demo_user not in TEAM:
            raise HTTPException(401, "Choose who you are viewing as.")
        return x_demo_user

    def manager(me: str = Depends(staff)):
        if me != "mgr":
            raise HTTPException(403, "Only the campus manager can do this.")
        return me

    def find(data, rid):
        r = next((x for x in data["requests"] if x["id"] == rid), None)
        if not r:
            raise HTTPException(404, "Request not found.")
        return r

    def can_see(me, r):
        if me != "mgr" and r["owner"] != me:
            raise HTTPException(403, "This case belongs to another specialist.")

    def owner_only(me, r):
        if me == "mgr":
            raise HTTPException(403, "The campus manager assigns and oversees. The specialist decides.")
        can_see(me, r)
        if r["status"] == "closed":
            raise HTTPException(409, "This case is closed.")

    # -------- staff

    @router.get("/team")
    def team(me: str = Depends(staff)):
        return {"team": TEAM, "services": SERVICES, "choices": CHOICES}

    @router.get("/requests")
    def list_requests(me: str = Depends(staff)):
        reqs = read()["requests"]
        if me != "mgr":
            reqs = [r for r in reqs if r["owner"] == me]
        return [staff_view(r) for r in reqs]

    @router.get("/requests/{rid}")
    def get_request(rid: str, me: str = Depends(staff)):
        r = find(read(), rid)
        can_see(me, r)
        return staff_view(r)

    @router.post("/requests/{rid}/assign")
    def assign(rid: str, body: AssignIn, me: str = Depends(manager)):
        with tx() as data:
            r = find(data, rid)
            if r["status"] == "closed":
                raise HTTPException(409, "This case is closed.")
            if body.owner not in TEAM or not TEAM[body.owner]["canOwn"]:
                raise HTTPException(400, "Choose a specialist.")
            r["owner"] = body.owner
            if r["status"] == "new":
                r["status"] = "assigned"
            log(r, f"Assigned to {TEAM[body.owner]['name']} by {TEAM[me]['name']}")
            return staff_view(r)

    @router.post("/requests/{rid}/note")
    def note(rid: str, body: TextIn, me: str = Depends(manager)):
        with tx() as data:
            r = find(data, rid)
            log(r, "Manager note: " + body.text.strip())
            return staff_view(r)

    @router.post("/requests/{rid}/decide")
    def decide(rid: str, body: DecideIn, me: str = Depends(staff)):
        with tx() as data:
            r = find(data, rid)
            owner_only(me, r)
            if not body.reason.strip():
                raise HTTPException(422, "Add a short reason.")
            needs_service = body.choice in ("SAS or university service", NOT_LD)
            if needs_service and body.service not in SERVICES:
                raise HTTPException(422, "Choose a service to suggest.")
            if body.choice == NOT_LD:
                r["status"] = "closed"
                r["closed"] = f"{NOT_LD} · suggested {body.service}"
                r["decision"] = {"choice": body.choice, "reason": body.reason.strip(), "by": me,
                                 "message": body.message.strip(), "response": None}
                log(r, f"Closed: suggested {body.service}")
            else:
                choice = body.choice + (f": {body.service}" if needs_service else "")
                r["decision"] = {"choice": choice, "reason": body.reason.strip(), "by": me,
                                 "message": body.message.strip(), "response": None}
                r["status"] = "waiting"
                log(r, f"Decision sent: {choice} (email + My requests)")
            if body.message.strip():
                r["messages"].append({"at": iso(now()), "from": me, "text": body.message.strip()})
                data["outbox"].append({"at": iso(now()), "requestId": rid, "subject": "SAS has replied to your request",
                                       "body": body.message.strip()})
            return staff_view(r)

    @router.post("/requests/{rid}/close")
    def close(rid: str, body: CloseIn, me: str = Depends(staff)):
        with tx() as data:
            r = find(data, rid)
            owner_only(me, r)
            if not body.reason.strip():
                raise HTTPException(422, "Add a reason for closing.")
            r["status"] = "closed"
            r["closed"] = body.reason.strip()
            log(r, "Closed: " + body.reason.strip())
            return staff_view(r)

    @router.post("/requests/{rid}/simulate-reply")
    def simulate_reply(rid: str, body: ReplyIn, me: str = Depends(staff)):
        """Demo only: stands in for the student's Accept / Not now."""
        with tx() as data:
            r = find(data, rid)
            can_see(me, r)
            _student_reply(r, body.response)
            return staff_view(r)

    @router.get("/questions")
    def questions(me: str = Depends(staff)):
        return read()["questions"]

    @router.post("/questions/{qid}/reply")
    def reply(qid: str, body: TextIn, me: str = Depends(staff)):
        with tx() as data:
            q = next((x for x in data["questions"] if x["id"] == qid), None)
            if not q:
                raise HTTPException(404, "Question not found.")
            q["reply"] = body.text.strip()
            return q

    @router.get("/concerns")
    def concerns(me: str = Depends(manager)):
        return read()["concerns"]

    @router.post("/concerns/{cid}/resolve")
    def resolve(cid: str, body: TextIn, me: str = Depends(manager)):
        with tx() as data:
            c = next((x for x in data["concerns"] if x["id"] == cid), None)
            if not c:
                raise HTTPException(404, "Concern not found.")
            c["done"] = True
            c["response"] = body.text.strip()
            r = next((x for x in data["requests"] if x["id"] == c["case"]), None)
            if r:
                log(r, f"Concern {cid} resolved by {TEAM[me]['name']}")
            return c

    @router.post("/dev/reset")
    def reset():
        with _lock:
            _write(build_seed())
        return {"ok": True}

    # -------- student (the demo student is /api/me)

    def mine(data, rid):
        r = find(data, rid)
        if r["studentId"] != get_me()["studentId"]:
            raise HTTPException(404, "Request not found.")
        return r

    @router.post("/student/requests")
    def student_create(body: StudentRequestIn):
        me = get_me()
        f = body.screening.flags
        areas = dict(zip(AREAS, [f.soundWeak, f.slow, not f.understood, f.spellingWeak]))
        first, last = (me["name"].split() + [""])[:2]
        lang = f"{body.language.first} first" + ("" if body.language.first == "English"
                                                   else f" · {body.language.years.replace('-', '–')} yrs English")
        contact = " · ".join(x for x in [body.contact, body.format.lower(), body.needs.strip()] if x)
        with tx() as data:
            created = now()
            r = {
                "id": next_id(data["requests"], "R"), "studentId": me["studentId"], "type": body.type,
                "createdAt": iso(created), "dueAt": iso(add_working_days(created, 2)),
                "status": "new", "owner": None, "student": f"{first} {last[:1]}.".strip(),
                "contact": contact, "language": lang, "areas": areas,
                "history": history_label(body.screening.history), "note": body.note.strip(),
                "consider": consider_text(areas, body.language.years),
                "decision": None, "closed": None, "messages": [],
                "timeline": [{"at": iso(created), "text": "Request received (student consented)"}],
            }
            data["requests"].append(r)
            return student_view(r)

    @router.get("/student/requests")
    def student_list():
        sid = get_me()["studentId"]
        return [student_view(r) for r in read()["requests"] if r["studentId"] == sid]

    @router.post("/student/requests/{rid}/respond")
    def student_respond(rid: str, body: ReplyIn):
        with tx() as data:
            r = mine(data, rid)
            _student_reply(r, body.response)
            return student_view(r)

    @router.post("/student/requests/{rid}/withdraw")
    def student_withdraw(rid: str):
        with tx() as data:
            r = mine(data, rid)
            r["status"] = "closed"
            r["closed"] = "Withdrawn by student"
            r["note"] = ""
            log(r, "Withdrawn by student (note cleared)")
            return student_view(r)

    @router.post("/student/questions")
    def student_question(body: TextIn):
        with tx() as data:
            q = {"id": next_id(data["questions"], "Q"), "text": body.text.strip(), "reply": ""}
            data["questions"].insert(0, q)
            return {"id": q["id"]}

    @router.post("/student/concerns")
    def student_concern(body: ConcernIn):
        with tx() as data:
            r = mine(data, body.requestId)
            c = {"id": next_id(data["concerns"], "C"), "case": r["id"], "text": body.text.strip(), "done": False}
            data["concerns"].insert(0, c)
            log(r, "Student raised a concern")
            return {"id": c["id"]}

    return router


def _student_reply(r: dict, response: str) -> None:
    if not r["decision"] or r["status"] != "waiting":
        raise HTTPException(409, "There is no decision waiting for a reply.")
    r["decision"]["response"] = response
    if response == "Accepted":
        r["status"] = "progress"
    log(r, f"Student replied: {response}")
