# LexPace in Blackboard: hackathon demo

A clickable Blackboard Ultra–style student portal (AURAK) with LexPace built in:
**screening → support profile → adapted lecture**, plus **reading training**.

## Start the demo (one command)

You need **Python 3.10+** and **Node.js 18+**.

| Windows | Mac / Linux |
|---|---|
| `run.bat` | `./run.sh` |

Then open **http://localhost:8000**. Press **Ctrl+C** to stop both servers.

The command installs the Python and npm packages, builds the React shell, and starts the training
Node server (port 3000) and FastAPI (port 8000) together. Once it has run fully, you can start
it **offline** at the venue with:

```
run.bat --skip-install            (or ./run.sh --skip-install)
```

`--skip-build` also reuses the existing `frontend/dist`. Ports can be changed with the `PORT`
and `TRAINING_PORT` environment variables.

**Developer mode (hot reload):** start the training app (`cd Training/LexPace && npm start`), then
FastAPI (`python -m uvicorn main:app --app-dir backend --port 8000`), then Vite
(`cd frontend && npm run dev`) and open http://localhost:5173. Vite proxies `/api` and
`/lexpace` (plus the training paths) to FastAPI, so it all stays on one origin.

## 2-minute click-path for judges

1. **Courses** opens on the single Computer Architecture card. Click it.
2. The course page looks like Blackboard Ultra: content list, folders that open and close, and Course Faculty on the right.
   Open the new **LexPace** tab (last tab, after Achievements).
3. It says *"Your support profile: Not screened yet"*. Click **Take LexPace Screening**,
   or, to save time, pick a profile in **Or choose a profile** (for example *Surface*).
4. Click **Week 6–7: Pipelining (Chapter 4)**. The adapted lecture opens inside the course on that
   profile. The other weeks are greyed out ("Adaptation coming soon").
5. In the lecture's left menu, switch between the six profiles (for example *Rapid naming*, then
   *Double deficit*) and show how the same page adapts.
6. Sidebar **Tools → LexPace Screening**: the 7-game reading check. When it finishes, it saves the
   profile and shows **Open my adapted lecture**, which goes straight back to step 4.
7. **Tools → LexPace Training**: accelerated reading training (calibration → session → progress),
   saved by the training app's own server.

To reset the demo to "Not screened yet", choose *Not screened yet* in the picker on the LexPace tab.

## Folder structure

```
run.bat / run.sh / run.py   one-command launcher (run.py does the work on both platforms)
frontend/                   React + Vite + React Router: the Blackboard shell only
  public/theme.css          Blackboard palette (CSS variables), shared with the LexPace parts
  public/aurak-logo.png     cropped from screenshots/bb-tools.png
  src/pages/                Profile, Courses, Tools, ToolFrame, CoursePage, ContentTab, LexPaceTab
backend/
  main.py                   FastAPI: API, static LexPace parts, training proxy, SPA fallback
  data/demo.json            all demo data + the saved support profile
  static/lexpace/           copies of the LexPace static parts, served at /lexpace/
    screening/              copy of /screening (structure intact)
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
| GET | `/api/lexpace/profile` | `{profile, label, source, updatedAt}`, `profile` null if not screened |
| POST | `/api/lexpace/profile` | body `{"profile": "base\|phon\|surf\|rapid\|double\|mixed" or null, "source": "..."}` |

Other routes on the same origin:
- `/lexpace/screening/` and `/lexpace/adaptation.html`: static files.
- `/lexpace/training/…`: proxied to the training app's Node server.
- `/api/rap/…`, `/rap/…`, `/dev/login` and `/internal/rap/…`: also proxied, because the training
  app uses these absolute paths.

## How the three LexPace parts are integrated

All three keep their content and behaviour. The only changes:

- **Screening** (`backend/static/lexpace/screening/index.html`, marked `LexPace integration`):
  - Two `<link>` tags add the Blackboard colours.
  - A small `onComplete` hook maps the result to a profile id and stores it in two places:
    `POST /api/lexpace/profile` and localStorage `pl2-prof`. The mapping is
    `none→base`, `phonological→phon`, `surface→surf`, `rapid_naming→rapid`,
    `double_deficit→double`, `mixed→mixed`.
  - The hook also adds an **Open my adapted lecture** button above the results.
- **Adaptation** (`backend/static/lexpace/adaptation.html`): three lines that add the colour
  override, right after its main `<style>` block. Nothing else changed (checked with `cmp`).
- **Training**: no files changed. The FastAPI proxy injects the colour override `<link>` into its
  HTML responses. Its `data/db.json` loads and saves through the proxy.

The shell writes the saved profile into localStorage `pl2-prof` before it opens the lecture, so the
lecture opens on that profile. The lecture's store reads values with `JSON.parse`, so the value is
written JSON-encoded (`"surf"`).

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
- The six profile colours inside the lecture are kept, because they tell the profiles apart.
- The training app has no API keys (`config.md` only lists `PORT` and optional LTI settings),
  so no `.env` was needed.

## Skipped / known limits

- **Offline fonts:** screening and adaptation load *Lexend* / *Atkinson Hyperlegible* / *IBM Plex
  Mono* from Google Fonts (CDN). Offline, they fall back to system fonts. Everything still works,
  but the dyslexia-friendly fonts won't show. To fix, download the fonts into the LexPace folders.
- **Training profile sync:** the screening profile isn't passed into the training app.
  Its `dyslexiaProfile` stays `unprofiled`, because it has no endpoint to set it. Calibration
  and sessions work anyway.
- **Profile picker:** kept on the LexPace tab even though the screening hand-off works. The
  screening takes about 10 minutes, so judges can switch profiles without it.
- **Testing:** the end-to-end check ran in Chromium (Playwright) on the single-port build. The
  screening hand-off was tested by calling its hook with a sample result, not by playing all 7 games.
