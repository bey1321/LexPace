# TRAINING_PLAN.md

Exploration-only findings for adding three training modules (Number Sense Practice,
Reading Fluency Practice, Writing Practice) alongside the existing LexPace app.
No code was written in this session.

## 1. Codebase summary

Three independently-run processes, glued onto one origin by FastAPI:

- **`backend/`** — Python 3.10+, FastAPI (`main.py`). Serves a small JSON API backed by a
  single flat file (`backend/data/demo.json`, lock + atomic-write), hosts the adaptive
  screening pipeline (`backend/screening/`: router, generator, evaluation, features,
  classifier, LLM wrapper, config), and reverse-proxies the Training app and the external
  SAS Portal onto the same origin.
- **`frontend/`** — React 18 + Vite 5 + react-router-dom 6. A Blackboard-Ultra-style shell
  (`src/pages/`: Profile, Courses, Tools, CoursePage, ContentTab) with one sidebar item,
  **LexPace** (`src/pages/lexpace/LexPace.jsx`), implemented as its own nested `<Routes>`
  tree (Home → check/courses/training/requests/results). `src/api.js` has two tiny helpers:
  `getJSON`/`useApi` (fetch) and `saveVersion`.
- **`Training/LexPace/`** — separate Node/Express app (own `package.json`, own server,
  own auth, own flat-JSON store `data/db.json`). Implements "RAP": calibration → timed
  reading session with letter-masking → progress → oversight. Static pages under
  `public/rap/*.html` (vanilla JS/CSS, no framework). FastAPI proxies it at
  `/lexpace/training/...`, `/rap/...`, `/api/rap/...`, `/internal/rap/...`, `/dev/login`.
- **SAS Portal** (`sas-portal/`, port 8010) — **not in this repo.** Only its student-facing
  routes are forwarded, via `/api/sas/student/...` in `backend/main.py`.
- One-command launcher: `run.py`/`run.bat`/`run.sh` (installs deps, builds the frontend,
  starts Training on :3000 and FastAPI on :8000 together).

## 2. Where trainings go

The natural new entry point is a second top-level sidebar item (parallel to the existing
**LexPace** item), e.g. `/practice-hub/*`, implemented the same way `LexPace.jsx` is: a
`Layout` + `Home` (tiles) + one child route per module, under a new
`frontend/src/pages/practice/` directory. Each module is then just another tile/child route.
Reaching it from navigation needs exactly one additive line in `Sidebar.jsx`'s `ITEMS` array
and one additive route line in `App.jsx` — no existing route or page needs to change.

**This has one open question, see §7.1**: the existing `Training/LexPace/` Node app already
does timed reading training (RAP), which overlaps functionally with "Reading Fluency
Practice." Whether that app is in-scope to build on, or is "the rest of the app" to leave
alone, isn't settled by the brief and changes the plan materially.

## 3. What exists and can be reused

| Item | Exists? | Where | Notes |
|---|---|---|---|
| Login / pseudonymised student ID | **Partial** | `backend/main.py` `/api/me` (hardcoded demo user in `demo.json`); `Training/LexPace/src/lti.js` (`req.user = {id, courseId, role}` via `/dev/login` cookie stub or sketched-but-inactive real LTI 1.3) | No unified auth; two separate demo identities, neither is real session auth. New modules should reuse `/api/me`'s student id (same-origin, no cookie dance) rather than the Training app's separate stub. |
| Data storage / database | **No real DB** | `backend/data/demo.json` (locked + atomic write); `Training/LexPace/data/db.json` (no locking, explicitly flagged in its own README as unsafe for concurrent writes) | Reusable *pattern* (FastAPI's lock+atomic-write JSON helper), not a reusable store. |
| Backend that can call an LLM with protected keys | **Yes** | `backend/screening/llm.py` + `backend/screening/config.py` | Backend-only Anthropic client, JSON-schema structured output, typed `LLMError`, env-driven config, `.env` loader. Good template; scoped inside the `screening` package today, so needs generalizing (not modifying) into a shared location. |
| LMS connection — reading course files | **Partial, shape only** | `/api/courses/{id}/content` and `/api/lexpace/materials` in `backend/main.py`, reading from `demo.json` | Content items are **not real files** — clicking shows a "Demo item" notice (per root README). No file storage or parser exists behind this API. |
| LMS connection — student activity log (file opened?) | **No** | — | Grepped the whole repo; the only "Activity" reference is a static placeholder page (`EmptyPage` in `App.jsx`) with no real tracking. This is a genuine gap, not a reuse. |
| Show SAS staff only what a student chose to share | **UX pattern only, not reusable code** | `frontend/src/pages/lexpace/LexPace.jsx` (`SasReferral`, `MyRequests`) | Student-facing opt-in flow with a "SAS will see / never shared" preview and Accept/Withdraw/Raise-concern controls — a strong *design template* to copy. But the SAS-side storage and staff view live in the external `sas-portal` app we don't have, so there's no code here for "staff sees only shared fields." |
| Existing tests, how to run | **Yes, backend only** | `backend/tests/test_screening.py`, 33 cases; `pytest.ini` (`testpaths = backend/tests`); run via `python -m pytest` from repo root (needs `pytest`, `pytest-asyncio`); LLM calls faked via monkeypatch, no network needed | **No tests at all** for `frontend/` (no test runner in `package.json`) or `Training/LexPace/` (no `test` script). |

## 4. What is missing

- Real authentication/session management (everything today is one hardcoded demo user or a dev-login stub).
- A real course-file store and parser (PDF/PPTX → text) — ingestion logic exists (see §3) but needs raw text handed to it already; there's no code that extracts text from an actual LMS file.
- Any activity/engagement log (file-open tracking).
- A real database — everything is flat JSON, single-writer.
- A generalized LLM helper usable without importing the `screening` package's internals.
- Any staff-facing UI in this repo at all (SAS Portal, which might have one, is external).
- A content-approval staff workflow (Generator AI → checks → Checker AI → staff approval → bank). Nothing like this exists. The closest structural precedents are `backend/screening/generator.py`'s generate→validate→retry→fallback-to-bank loop, and `Training/LexPace/src/services/contentIngestionService.js`'s extract→filter pipeline — both good patterns to model from, neither reusable directly.

## 5. Shared components (built once)

| Component | Status | Where it would live |
|---|---|---|
| Training area entry point | **Must be created** | `frontend/src/pages/practice/Practice.jsx` (hub) + child routes, modeled on `LexPace.jsx`'s own Routes/Outlet/Layout pattern. One additive line each in `Sidebar.jsx` and `App.jsx`. |
| Private progress page framework | **Must be created** | New React page(s) + new backend endpoints (e.g. `/api/practice/progress`), backed by a **new** JSON store file (e.g. `backend/data/practice.json`), following `main.py`'s `load_data`/`save_data` lock+atomic-write pattern but in its own module so `demo.json` isn't touched. |
| Optional sharing to SAS | **Needs extending, partly blocked** | Reuse the `SasReferral` UX pattern as a template. Backend-side, extend the `/api/sas/student/...` proxy in `main.py` with a new forwarded path — but we don't have the SAS Portal's API contract for progress data, so the shape of "SAS sees only shared fields" can't be finalized yet (see §7.2). |
| LLM service (backend only, schema validation, logs model + prompt version) | **Needs extending** | Generalize `backend/screening/llm.py` into a non-screening-specific module (e.g. `backend/llm/client.py`). Current version doesn't log prompt/model version per call — add that as part of generalizing it. |
| Before-term preparation flow (Generator AI → checks → Checker AI → staff approval → bank) | **Must be created** | New package, e.g. `backend/practice/prep/`, with its own approved-content store. Model the generate→validate→retry→fallback loop on `screening/generator.py`; model raw-text handling on `contentIngestionService.js`. |
| Staff review screen | **Must be created** | No staff-facing UI exists anywhere in this repo. New frontend route + new backend endpoints, entirely from scratch. |
| Configuration for named settings | **Needs extending (new sibling, not a change)** | `backend/screening/config.py` is a clean, reusable pattern (env-var driven, `.env` loader, typed). Add a sibling, e.g. `backend/practice/config.py`, rather than overload the screening one. |

## 6. Files and folders that must not be touched

Confirmed screening / other-team territory, left alone:
`backend/screening/*`, `backend/static/lexpace/*`, `screening/` (root copy, reference),
`adaptation.html`, `frontend/src/pages/lexpace/*`, `frontend/src/pages/Profile.jsx`,
`Courses.jsx`, `CoursePage.jsx`, `ContentTab.jsx`, `backend/data/demo.json`'s existing keys.

`Training/LexPace/*` is **not touched by this plan**, pending the answer to §7.1 — if Reading
Fluency Practice is meant to build on it, that changes this list.

Only additive, single-line touches to shared files are expected:
- `frontend/src/components/Sidebar.jsx` — add one nav entry
- `frontend/src/App.jsx` — add one route for the new hub
- `backend/main.py` — add one `app.include_router(...)` line for a new practice router (same pattern as the existing screening router mount)

Everything else is net-new: `frontend/src/pages/practice/`, `backend/practice/`,
`backend/data/practice.json` (or similar), `backend/tests/test_practice.py`.

## 7. Open questions

1. **Is `Training/LexPace/` (the existing RAP app) in-scope or off-limits?** It already does
   timed reading training with calibration/pacing — functionally overlapping with "Reading
   Fluency Practice." The brief's protected list (screening games, classifier, hand-off,
   login, LMS connection, shell) doesn't name it either way. This changes the plan for
   module 2 significantly and should be confirmed before that session starts.
2. **How does "optional sharing to SAS" actually reach SAS staff?** The SAS Portal isn't in
   this repo, so its API contract for accepting shared progress data (and whether it can
   show staff only the shared fields) is unknown. Needs either the SAS Portal's code/docs,
   or an agreed stub contract to build against.
3. **No real course-file or activity-log infrastructure exists.** If any training's content
   prep or eligibility genuinely needs "did the student open file X," that is net-new work,
   not reuse — worth confirming this is expected before the relevant module's session.
4. **No real auth across the whole app.** Every piece uses a hardcoded demo student or a
   dev-login stub. The brief's "pseudonymised student ID" may imply something more deliberate
   than the current ad hoc demo IDs — worth clarifying whether unified identity needs
   building now or can keep reusing `/api/me`.
5. **`Training/LexPace/data/db.json` is currently committed to git**, unlike
   `backend/data/screening_sessions/` (git-ignored). If the new progress store holds
   real-shaped student data even in demo form, it should be git-ignored from the start —
   flagging so this isn't copied as the pattern.
6. **No frontend or Node test runner is configured anywhere** — only backend pytest exists.
   If the new modules are mostly frontend/Node work, there's no existing automated-test
   pattern to extend; decide now whether to add one (e.g. Vitest) or rely on manual QA.
