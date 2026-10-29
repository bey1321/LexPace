# LexPace in Blackboard: hackathon demo

A clickable Blackboard Ultra–style student portal (AURAK) with LexPace built in:
**screening → support profile → adapted lecture**, plus **reading training**.

## Start the demo (one command)

You need **Python 3.10+** and **Node.js 18+**.

| Windows | Mac / Linux |
|---|---|
| `.\run.bat` | `./run.sh` |

Then open **http://localhost:8000**. Press **Ctrl+C** to stop both servers.

The command installs the Python and npm packages, builds the React shell, and starts the training
Node server (port 3000) and FastAPI (port 8000) together. Once it has run fully, you can start
it **offline** at the venue with:

```
.\run.bat --skip-install          (or ./run.sh --skip-install)
```

`--skip-build` also reuses the existing `frontend/dist`. Ports can be changed with the `PORT`
and `TRAINING_PORT` environment variables.

**Developer mode (hot reload):** start the training app (`cd Training/LexPace && npm start`), then
FastAPI (`python -m uvicorn main:app --app-dir backend --port 8000`), then Vite
(`cd frontend && npm run dev`) and open http://localhost:5173. Vite proxies `/api` and
`/lexpace` (plus the training paths) to FastAPI, so it all stays on one origin.

## 2-minute click-path for judges

LexPace has its own item in the sidebar, **LexPace** (below Tools). On the **first visit** it shows
**Welcome to LexPace** with **Start the check** or **Skip for now**. After that it looks like the
Tools page: three tiles, **LexPace check** (to retake), **My courses** and **Training**. Each page
has a **← LexPace** link back. If the check was skipped, My courses shows one quiet line offering it.

1. **LexPace check** (optional): the 7-station adaptive check in **English** or **العربية**.
   Questions adapt to accuracy and speed; the maths stations keep their timers. **Go to my
   courses** in the bar above it leaves at any time (skipping it means the base lesson).
2. **My courses** shows **Your format** and where it came from: *check skipped*, *check done,
   results pending* (until the trained model is connected), or *from your check*. **Change
   format** picks another one (for example *Reading support*).
3. **My courses** lists the courses. Open **Computer Architecture** to see the chapters the teacher
   uploaded. Each one says **Ready in your format** or **Not in your format yet**.
4. Click **Week 6–7: Pipelining (Chapter 4)**. The adapted lecture opens on your format. In its
   left menu, switch between the four versions and show how the same page adapts.
5. Click any other chapter: it shows **Generate this format**. In this demo it answers "Coming
   soon"; only Week 6–7 is transformed.
6. **Training**: accelerated reading training (calibration → session → progress), saved by the
   training app's own server.

The old entry points (the course's LexPace tab, Tools → LexPace Training) redirect here.

To show the welcome screen again, run in the browser console:
`fetch('/api/lexpace/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"version":null}'})`.

## Lesson versions

LexPace covers the three areas of Specific Learning Disorder with four versions of each lecture.
Students only ever see the version names, never the name of a condition:

| id | Shown as | Picked when |
|---|---|---|
| `base` | Base lesson | no skill flag is on |
| `read` | Reading support | only the `reading` flag is on |
| `write` | Writing support | only the `writing` flag is on |
| `calc` | Calculation support | only the `math` flag is on |

The screening outputs three skill flags, `{ reading, writing, math }`, plus a 0–1 score for each.
If several flags are on, the version with the strongest score is used (*TODO: combine supports
once the lecture page can stack them*). Only the flags and the chosen version are stored, never a
diagnosis label.

- **reading**: on if any reading signal from the seven games is weak (sound decoding, spelling,
  irregular words, reading speed), or if the ML model's reading signal is at or above `modelRisk`.
- **writing** and **math**: always `false` for now. The screening has no writing or calculation
  task yet (*TODO in `src/scoring/rules.js`*).

## Adaptive screening (English and Arabic)

```
Student → adaptive games → LLM generates the next item (backend only) → deterministic scoring
        (LLM scores written expression only) → feature vector → trained ML classifier → results
```

The games are `backend/static/lexpace/journey/en.html` and `ar.html`, served at
`/lexpace/journey/`. They are the starter files `lexpace_games_timed_en.html` /
`lexpace_games_timed_ar.html` (kept unchanged in the root) with the same screens and text. Only
their data calls changed: items come from, and answers go to, `/api/screening`. The backend lives
in `backend/screening/`:

| File | What it does |
|---|---|
| `generator.py` | Builds the next item at the current difficulty. The LLM returns JSON (question, options, answer, difficulty, skill), which is validated strictly; a repeat or invalid item is retried once, then replaced by a starter item. Number Challenge items are generated in code, so their answers are correct by construction. Math Reasoning items must include an arithmetic expression that the backend evaluates and checks against the marked answer. |
| `activities.py` | Trial counts and time limits (unchanged: 8 s, 10 s, 25 s, 40 s), plus the adaptive staircase: fast and correct → harder, wrong or timed out → easier. |
| `evaluation.py` | Deterministic scoring: chosen index vs the server-side key, normalised spelling match with an error pattern (omissions, insertions, substitutions, transpositions), and timeouts. Written expression is the only LLM-scored task, on a fixed 1–4 rubric for grammar, punctuation, organization and clarity, plus error counts. |
| `features.py` | 70 named features (`lexpace.features/v1`), kept per skill: accuracy, response time, difficulty reached, error patterns, timeouts, writing scores, learning history. There is no single overall score. |
| `classifier.py` | Interface for the trained model, with three independent multi-label outputs: `reading`, `writing`, `math`. It has **no rules and never uses the LLM**. With no model connected it returns `model_not_connected`. |
| `bank.py` | The starter items, used as the offline fallback and as format examples. |

**Turning the LLM on:** copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`. The key is read
only by the backend. The model is `claude-opus-5-5`, with server-side refusal fallback on (turn it
off with `LEXPACE_LLM_FALLBACKS=0`). Without a key, the games use the starter items and writing
is not scored. Everything else works the same. `GET /api/screening/status` shows which mode is
active and the last LLM error.

**Connecting the trained model:** set `LEXPACE_CLASSIFIER_MODEL` to a JSON export (multi-label
logistic format, documented in `classifier.py`), or set `LEXPACE_CLASSIFIER=module:factory` for
any Python model, such as scikit-learn. When it returns outputs, the student's lesson version is
saved automatically (`read` / `write` / `calc`, or `base`).

**Saved data:** each completed session (trials, writing text, features, classifier output) is
written to `backend/data/screening_sessions/` (git-ignored) as training data for the model.

**Tests:** `pip install pytest pytest-asyncio`, then `python -m pytest` (in the repo root) runs 33 tests on validation, scoring, features,
the classifier interface and a full EN and AR session over HTTP. The LLM is faked in the tests.

## Folder structure

```
run.bat / run.sh / run.py   one-command launcher (run.py does the work on both platforms)
frontend/                   React + Vite + React Router: the Blackboard shell only
  public/theme.css          Blackboard palette (CSS variables), shared with the LexPace parts
  public/aurak-logo.png     cropped from screenshots/bb-tools.png
  src/pages/                Profile, Courses, Tools, ToolFrame, CoursePage, ContentTab, LexPaceTab
backend/
  main.py                   FastAPI: API, static LexPace parts, training proxy, SPA fallback
  screening/                adaptive EN/AR screening pipeline (see above)
  tests/                    pytest suite for the screening pipeline
  data/demo.json            all demo data + the saved lesson version (lexpaceSupport)
  static/lexpace/           copies of the LexPace static parts, served at /lexpace/
    journey/                EN + AR adaptive games (en.html, ar.html, journey-api.js)
    screening/              copy of /screening (older 7-game version, no longer linked from Tools)
    adaptation.html         copy of /adaptation.html
    bb-overrides/           colour-only override sheets (screening, adaptation, training)
screening/ adaptation.html  untouched originals (reference)
Training/LexPace/           training app, unchanged, runs from its own folder
screenshots/                the Blackboard pages the shell copies
```

## API

| Method | Path | Returns |
|---|---|---|
| GET | `/api/me` | name, student ID, email |
| GET | `/api/courses` | the one course (Computer Architecture) |
| GET | `/api/courses/ca/content` | the course content list and folders |
| GET | `/api/lexpace/materials` | adapted materials (Week 6–7 available, others coming soon) |
| GET | `/api/lexpace/profile` | `{version, label, skills, source, updatedAt}`, `version` null if not screened |
| POST | `/api/lexpace/profile` | body `{"version": "base\|read\|write\|calc" or null, "skills": {"reading": bool, "writing": bool, "math": bool}, "source": "..."}`. `skills` is optional (a manual pick has none) |

| GET | `/api/screening/status` | LLM on/off, model, last LLM error, classifier, feature names |
| POST | `/api/screening/sessions` | body `{"language": "en"\|"ar", "context": {...}}` → `session_id`, trial plan |
| POST | `/api/screening/sessions/{id}/items` | body `{"activity": "lexical"\|"sound"\|"spelling"\|"writing"\|"comprehension"\|"number"\|"reasoning"}` → next item (no answer key) |
| POST | `/api/screening/sessions/{id}/answers` | body `{item_id, response, latency_ms, timeout, question_index?, audio_plays?, lookbacks?}` → `{correct, timeout}` |
| POST | `/api/screening/sessions/{id}/complete` | body `{history, passage_reading_ms}` → features + classifier output |

Other routes on the same origin:
- `/lexpace/screening/` and `/lexpace/adaptation.html`: static files.
- `/lexpace/training/…`: proxied to the training app's Node server.
- `/api/rap/…`, `/rap/…`, `/dev/login` and `/internal/rap/…`: also proxied, because the training
  app uses these absolute paths.

## How the three LexPace parts are integrated

All three keep their content and behaviour. The only changes:

- **Screening** (`backend/static/lexpace/screening/index.html`, marked `LexPace integration`):
  - Two `<link>` tags add the Blackboard colours.
  - A small `onComplete` hook takes the chosen version and skill flags from the result and stores
    them in two places: `POST /api/lexpace/profile` and localStorage `pl2-prof`.
  - The hook also adds an **Open my adapted lecture** button above the results.
  - The scoring (`src/scoring/rules.js`, `decide.js`) and the team view (`src/views/results.js`)
    output skill flags and a version instead of profiles. The root `screening/` copy is kept in sync.
    Only `index.html` differs between the two copies. The app loads the copy in `backend/static/lexpace/screening/`.
  - The ML model file (`model/lexpace_model.json`) is unchanged. It was trained on the old reading
    profiles, so only its overall reading signal is used. Its per-class output is never shown or stored.
- **Adaptation** (`backend/static/lexpace/adaptation.html`): unchanged, and identical to the root
  copy. The current version has no Blackboard colour override, so it shows its own colours.
- **Training**: no files changed. The FastAPI proxy injects the colour override `<link>` into its
  HTML responses. Its `data/db.json` loads and saves through the proxy.

The shell writes the saved version into localStorage `pl2-prof` before it opens the lecture, so the
lecture opens on that version. The shell and the lecture share one origin, so no change to
adaptation.html is needed. The lecture's store reads values with `JSON.parse`, so the value is
written JSON-encoded (`"read"`). The lecture's own menu still lets the student switch versions.

## Theme

Colours were sampled from the screenshots with PIL:

| Element | Colour |
|---|---|
| Sidebar | `#262626` |
| Active item | `#000000`, with a `#c56fd5` purple bar |
| Page background | `#f8f8f8` |
| Card borders | `#cdcdcd` / `#e5e5e5` |
| Banner purple | `#5c4261` → `#49354d` |
| Links | `#2073a1` |
| OPEN badge | `#046df6` |

Fonts are system fonts:
- Body: Open Sans / Segoe UI / Arial
- Headings like "Courses" and "Tools": Georgia

No UI library, and no CDN in the shell.

## Assumptions

- The Blackboard course page opens full-width, without the left sidebar, as in
  `bb-course-content.png`. The home button and the "Courses" crumb lead back.
- Some details aren't in the screenshots, so I invented demo values:
  - the course code `CENG335_1_FALL2026`
  - the two files inside the collapsed "ISA References" folder
  - the titles of the "coming soon" weeks
  - the course card image (cropped from the course banner)
- Content items are not real files. Clicking them shows a small "Demo item" notice.
- **LexPace Training** opens through the training app's own `/dev/login` stub, as student
  `2023006229`. That is its documented stand-in for an LTI launch. It lands on calibration.
- The colour overrides apply to light mode only. If the computer is in dark mode, screening and
  the lecture keep their own dark palettes (their dark rules have higher specificity). Use light
  mode for the demo.
- The version colours inside the lecture are its own and are kept.
- The training app has no API keys (`config.md` only lists `PORT` and optional LTI settings),
  so no `.env` was needed.

## Skipped / known limits

- **Offline fonts:** screening and adaptation load *Lexend* / *Atkinson Hyperlegible* / *IBM Plex
  Mono* from Google Fonts (CDN). Offline, they fall back to system fonts. Everything still works,
  but the reading-friendly fonts won't show. To fix, download the fonts into the LexPace folders.
- **Training sync:** the screening result isn't passed into the training app. Its internal
  `dyslexiaProfile` field (Training/LexPace, left unchanged) stays `unprofiled`, because it has
  no endpoint to set it. Calibration and sessions work anyway. *TODO: rename that field to a skill
  flag when the training app is updated.*
- **Version picker:** kept on the LexPace tab even though the screening hand-off works. The
  screening takes about 10 minutes, so judges can switch versions without it.
- **Writing and calculation screening:** not built yet. Those flags are always `false` until the
  screening has a writing task and a calculation task.
- **Testing:** the end-to-end check ran in Chromium (Playwright) on the single-port build. The
  screening hand-off was tested by calling its hook with a sample result, not by playing all 7 games.

## My SAS requests (student side of the SAS Portal)

**LexPace → My SAS requests** lists the requests the student sent to Student Accessibility Services:
status, their contact person, the specialist's message with **Accept** / **Not now**, **Withdraw**
and **Raise a concern**. The SAS Portal itself is a separate app (`../sas-portal`, port 8010);
LexPace's backend forwards only `/api/sas/student/...` to it (`SAS_URL`, default
`http://127.0.0.1:8010`). Start it with `python run.py` in `sas-portal/` before the demo. If it is
not running, the page says SAS is not reachable.

Demo: the sample case **R-102** belongs to the demo student and waits for a reply. Accept it in
LexPace, then see it as **In progress** in the SAS Portal (LD specialist, My cases).
