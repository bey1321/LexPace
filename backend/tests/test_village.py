"""Tests for the village journey pages (journey/village-en.html, village-ar.html): the game layer must not
change the assessment.

- static: the station code is copied from the classic en.html / ar.html; every line outside the marked
  presentation hooks must be byte-identical, so items, answers, timers and scoring calls are unchanged.
- adapters: a shelf maps to the exact answer index the classic page sends.
- browser (optional, needs `pip install playwright` and `python -m playwright install chromium`):
  plays Word Rush on both pages with the same choices and compares the API traffic and the timing.
"""

import json
import re
import shutil
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # backend/ on the import path

JOURNEY = Path(__file__).resolve().parents[1] / "static" / "lexpace" / "journey"
LANGS = ("en", "ar")
TIMER = {"en": "startTimer", "ar": "timer"}  # the classic pages name their response-timer start differently

# Classic lines the village page replaces on purpose (presentation only). Each one is checked below.
CHANGED = ("function nav()", "function show(", "function go(", "function render()", "else if(stage===2)",
           "function download()", "function reset()")


def page(lang, village=True):
    return (JOURNEY / (f"village-{lang}.html" if village else f"{lang}.html")).read_text(encoding="utf-8")


def classic_station_lines(lang):
    lines = page(lang, village=False).split("\n")
    tag = '<script src="journey-api.js"></script><script>'
    start = next(i for i, l in enumerate(lines) if l.startswith("const stages=") or tag + "const stages=" in l)
    end = next(i for i, l in enumerate(lines) if l.startswith("function reset()"))
    out = lines[start:end + 1]
    out[0] = out[0].split(tag)[-1]
    return out


@pytest.mark.parametrize("lang", LANGS)
def test_station_code_is_copied_verbatim(lang):
    village, changed = page(lang), []
    for line in classic_station_lines(lang):
        if line.startswith(CHANGED):
            changed.append(line)
            continue
        assert line in village, f"classic line missing or altered in the village page: {line[:90]}"
    assert len(changed) == len(CHANGED)


@pytest.mark.parametrize("lang", LANGS)
def test_render_keeps_every_classic_branch_except_word_rush(lang):
    render = next(l for l in classic_station_lines(lang) if l.startswith("function render()"))
    body = render[len("function render(){"):]
    assert "function render(){if(!Village.allowsRender(stage))return;" + body in page(lang)
    # the other station branches of render() are on their own lines and covered by the verbatim test


@pytest.mark.parametrize("lang", LANGS)
def test_submit_functions_and_api_calls_unchanged(lang):
    village = page(lang)
    for name in ("submitWord", "submitSound", "submitSpelling", "submitWriting", "submitPassage",
                 "submitMathNumber", "submitMathReasoning", "submitHistory", "beginMathClock", "mathLimit"):
        line = next(l for l in classic_station_lines(lang) if re.match(rf"(async )?function {name}\(", l))
        assert line in village, name
    # Word Rush still requests the same item and starts the same response timer after showing it
    assert "const t=LP.step('lexical',trial,3);if(!t)return;WordRush.openBook(" in village
    assert f"LP.total('lexical'));{TIMER[lang]}()}}" in village
    # the shelf is converted to the classic index, then the classic submitWord() records it
    assert "selected=GameAdapters.WordRush.toResponse(shelf);const before=trial;await submitWord()" in village
    assert village.count('<script src="journey-api.js"></script>') == 1
    assert ('lang="ar" dir="rtl"' in village) == (lang == "ar")


def test_language_gate_routes_by_mother_tongue():
    gate = (JOURNEY / "village.html").read_text(encoding="utf-8")
    assert "هل اللغة العربية لغتك الأم؟" in gate and "Is Arabic your mother tongue?" in gate
    assert "location.href='village-ar.html'" in gate and "location.href='village-en.html'" in gate


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_word_rush_adapter_matches_classic_options():
    script = (
        "const A=require(process.argv[1]).WordRush;"
        "console.log(JSON.stringify([A.toResponse('real'),A.toResponse('madeup'),A.LABELS]));"
        "try{A.toResponse('floor');console.log('no-throw')}catch(e){console.log('throws')}"
    )
    out = subprocess.run(["node", "-e", script, str(JOURNEY / "village" / "adapters.js")],
                         capture_output=True, text=True, check=True).stdout.split("\n")
    # classic: options(['Real word','Made-up word']); the backend reads response 0 as "real word"
    assert json.loads(out[0]) == [0, 1, ["Real word", "Made-up word"]]
    assert out[1] == "throws"


# ---------------------------------------------------------------- browser regression (optional)

PATTERN = ["real", "madeup", "madeup", "real", "real", "madeup"]
SPOTS = [[58, 122], [326, 118], [86, 176], [262, 182], [36, 200], [352, 146]]  # wordrush.js floor books


@pytest.fixture
def server(tmp_path, monkeypatch):
    pytest.importorskip("playwright.sync_api")
    import uvicorn
    from screening import classifier, config, llm
    import main
    monkeypatch.setattr(llm, "enabled", lambda: False)  # starter items: the same sequence for both pages
    monkeypatch.setattr(config, "SESSIONS_DIR", tmp_path / "sessions")
    monkeypatch.setattr(classifier, "_classifier", None)
    data = tmp_path / "demo.json"
    data.write_text(main.DATA_FILE.read_text(encoding="utf-8"), encoding="utf-8")
    monkeypatch.setattr(main, "DATA_FILE", data)
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    srv = uvicorn.Server(uvicorn.Config(main.app, host="127.0.0.1", port=port, log_level="warning"))
    threading.Thread(target=srv.run, daemon=True).start()
    for _ in range(100):
        if srv.started:
            break
        time.sleep(0.05)
    yield f"http://127.0.0.1:{port}/lexpace/journey/"
    srv.should_exit = True


def _traffic(page):
    log = []
    page.on("response", lambda r: log.append((r.url.rsplit("/", 1)[1], json.loads(r.request.post_data or "{}"), r.json()))
            if "/api/screening/sessions/" in r.url and r.request.method == "POST" else None)
    return log


def _setup(page):
    page.locator("#app .btn").first.click()          # welcome -> setup
    page.locator("#app .actions .btn").last.click()  # setup -> start the session


@pytest.mark.parametrize("lang", LANGS)
def test_word_rush_matches_classic_page(server, lang):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        try:
            page = browser.new_page(viewport={"width": 1400, "height": 900})
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            village = _traffic(page)
            page.goto(server + f"village-{lang}.html")
            # timestamps of "word became visible" and "shelf committed", taken inside the page
            page.add_script_tag(content="""
              window.__open=[];window.__commit=[];
              new MutationObserver(()=>{if(!document.getElementById('wr-book').hidden)window.__open.push(performance.now())})
                .observe(document.getElementById('wr-book'),{attributes:true,attributeFilter:['hidden']});
              addEventListener('keydown',e=>{if(e.key==='Enter'&&!document.getElementById('wr-book').hidden)window.__commit.push(performance.now())},true);""")
            _setup(page)
            page.wait_for_selector("#panel", state="hidden")
            page.locator(".mission.current").click()
            page.wait_for_timeout(600)
            box = page.locator("#world").bounding_box()
            click = lambda x, y: page.mouse.click(box["x"] + x / 384 * box["width"], box["y"] + y / 224 * box["height"])
            for (x, y), shelf in zip(SPOTS, PATTERN):
                click(x, y - 4)
                page.wait_for_function("WordRush.debug().carrying", timeout=10000)
                assert page.locator("#wr-book").is_hidden()  # the word is not visible while carrying
                click(192, 124)
                page.wait_for_selector("#wr-book", state="visible", timeout=10000)
                page.wait_for_timeout(250)
                # the real-word shelf is on the left in English and on the right in Arabic (RTL)
                page.keyboard.press("ArrowLeft" if (shelf == "real") == (lang == "en") else "ArrowRight")
                page.keyboard.press("Enter")
                page.wait_for_function("WordRush.debug().mode==='free'", timeout=10000)
            click(192, 222)  # leave through the door: the Sound Lab becomes the next stop
            page.wait_for_function("stage===3", timeout=10000)
            opens, commits = page.evaluate("[window.__open, window.__commit]")

            classic_page = browser.new_page()
            classic = _traffic(classic_page)
            classic_page.goto(server + f"{lang}.html")
            _setup(classic_page)
            for shelf in PATTERN:
                classic_page.wait_for_selector("#continue")
                classic_page.locator(".choice").nth(0 if shelf == "real" else 1).click()
                classic_page.locator("#continue").click()
                classic_page.wait_for_timeout(300)
            classic_page.wait_for_function("stage===3")
        finally:
            browser.close()

    assert not errors
    items = lambda log: [(res["stimulus"], res["difficulty"]) for path, req, res in log if path == "items" and req == {"activity": "lexical"}]
    answers = lambda log: [(req, res) for path, req, res in log if path == "answers"]
    v, c = answers(village), answers(classic)
    assert len(v) == len(c) == 6
    assert items(village) == items(classic)                       # same words, same difficulty progression
    assert [sorted(r) for r, _ in v] == [sorted(r) for r, _ in c]  # same request body fields
    assert [r["response"] for r, _ in v] == [r["response"] for r, _ in c] == [0 if s == "real" else 1 for s in PATTERN]
    assert [res for _, res in v] == [res for _, res in c]          # same scoring
    # response time = word visible -> shelf committed (walking and the flight animation are excluded)
    assert len(opens) == len(commits) == 6
    for (req, _), o, k in zip(v, opens, commits):
        assert abs(req["latency_ms"] - (k - o)) < 150, (req["latency_ms"], k - o)
