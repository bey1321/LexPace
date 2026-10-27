# LexPace — Accelerated Reading (RAP) module

A working build of the Accelerated Reading training feature we designed:
calibration, personalized pacing (+10% over baseline), the letter-masking
training mechanic, profile-aware eligibility, progress tracking, and an
advisor-facing oversight view.

## Run it

```
npm install
npm start
```

Then open http://localhost:3000 and click "Simulate an LTI launch"
(`/dev/login`) — this stands in for a real Moodle/Canvas/Blackboard launch
until the real LTI wiring (below) is connected.

## What's real vs. stubbed

**Fully working:**
- Calibration (measures baseline words-per-minute from an untimed passage)
- Target pace calculation (baseline × 1.10 — the one ratio the dosage
  evidence actually supports; see `src/services/rapService.js`)
- The letter-masking training animation (`runMaskingSweep` in
  `public/rap/rap.js`) — masks left-to-right, never un-masks, so it
  structurally prevents regressions
- Multiple-choice comprehension checks after each sentence
- Session logging, progress dashboard, and recalibration every 5th
  completed session (adjusts the baseline, keeps the +10% ratio fixed —
  does not escalate acceleration beyond what the evidence supports)
- Profile-based eligibility (`double_deficit` profile is shown but not
  pushed, per the research finding that this profile responds least well)
- An oversight endpoint returning compliance data only (sessions completed,
  last session date) — never raw answers or content

**Stubbed, needs real infrastructure before production:**
- **Real LTI launch** — `src/lti.js` has the real `ltijs` wiring sketched
  in comments. It needs a MongoDB connection string and a registered
  Moodle/Canvas/Blackboard platform to activate. Until then, `/dev/login`
  simulates the same `req.user` shape so every downstream route behaves
  identically either way — swapping in the real launch shouldn't require
  touching the RAP routes or service at all.
- **Role-based access on `/api/rap/oversight/:studentId`** — currently any
  authenticated user can query any student's oversight data. Needs a real
  role check (SAS staff / advisor only) before this ever touches real
  student data.
- **Real sentence content — now actually implemented.** `src/services/contentIngestionService.js`
  does real sentence extraction + keyword derivation from raw text, exposed
  at `POST /internal/rap/content/process` exactly as the original spec
  described. `src/ingestRealCourseMaterial.js` runs it against genuine
  prose extracted from the CSCI 450 (Information Security and Privacy)
  syllabus — 19 real sentences extracted on the first run, replacing the
  old placeholder `seed.js` content (left in the repo but no longer called
  from `server.js`).
  Known heuristic limitations, found by testing on this real text rather
  than assumed: sentence splitting is regex-based and will misfire on
  abbreviations; keyword derivation just picks the longest non-stopword
  in the sentence, which occasionally grabs an adjective (e.g.
  "unacceptable") instead of the actual topic noun, or ties between two
  reasonable candidates and arbitrarily keeps the first (e.g. picking
  "Department" over "Counseling"). A production version should replace
  this with a real NLP-based keyword/noun-phrase extractor.
  Still missing: this only works on prose you hand it directly — there's
  no actual PDF/PPTX parser pulling text out of real LMS files yet, so
  whatever system calls this endpoint still needs to extract raw text
  from the course material first.
- **`dyslexiaProfile` on each student** — currently defaults to
  `unprofiled`. This needs to be set by the detection/screening module
  (the five-profile system) once that's wired in; right now there's no
  code path that sets it, so eligibility will always say "complete
  screening first" until that integration exists.
- **Storage** — using a flat JSON file (`src/store.js`) deliberately, to
  avoid any native build step. Fine for a hackathon demo; swap for a real
  database (and remove `data/db.json` from version control) before any
  real deployment, since it is not safe for concurrent writes at scale.

## Project layout

```
src/
  server.js          Entry point
  lti.js              Auth: real LTI sketch + working dev-login stub
  store.js            Minimal JSON file store
  seed.js             Sample sentence pool (placeholder content)
  services/
    rapService.js     All business logic — calibration, sessions,
                       recalibration, eligibility, oversight
  routes/
    rap.js            Express routes matching the agreed API spec
public/rap/
  calibration.html    Step 1: baseline speed measurement
  session.html        Step 2: the actual training session + masking
  progress.html        Student-facing progress dashboard
  rap.js               Shared client helpers (masking sweep, shuffle)
  rap.css
```

## Verified working end-to-end

Ran the full flow via curl during this build: login → calibration
(85-word passage read in 24s → 213 wpm baseline → 234 wpm target) →
eligibility → enroll → start session (per-sentence time budgets computed
correctly from target pace) → complete session (7/8 correct → 88%
comprehension, 237 wpm achieved) → progress → oversight. All numbers
matched the expected formulas.

Separately verified the real content pipeline: ran
`node src/ingestRealCourseMaterial.js` against actual syllabus prose,
got 19 real candidate sentences extracted (word counts 9-14, all passing
the usability filter), then confirmed a live training session actually
pulls from that real pool instead of placeholder content.
