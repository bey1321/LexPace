"""Tests for the adaptive screening pipeline. Run from the repo root: python -m pytest backend/tests

No network: the LLM is either off or replaced by a fake that returns prepared JSON.
"""

import json
import random
import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # backend/ on the import path

from fastapi.testclient import TestClient  # noqa: E402

from screening import classifier, config, evaluation, generator, llm  # noqa: E402
from screening.activities import ACTIVITIES, next_level  # noqa: E402
from screening.bank import BANK  # noqa: E402
from screening.features import FEATURE_NAMES  # noqa: E402
from screening.textnorm import edit_ops, to_western_digits  # noqa: E402


# ---------------------------------------------------------------- fixtures

@pytest.fixture
def no_llm(monkeypatch):
    monkeypatch.setattr(llm, "enabled", lambda: False)


@pytest.fixture
def fake_llm(monkeypatch):
    """Replaces the Claude call: each test pushes the JSON objects the 'model' should return."""
    queue = []

    async def generate_json(system, prompt, schema, **kw):
        if not queue:
            raise llm.LLMError("no fake response queued")
        item = queue.pop(0)
        if isinstance(item, Exception):
            raise item
        return item

    monkeypatch.setattr(llm, "enabled", lambda: True)
    monkeypatch.setattr(llm, "generate_json", generate_json)
    return queue


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "SESSIONS_DIR", tmp_path / "sessions")
    monkeypatch.setattr(classifier, "_classifier", None)
    import main
    data = tmp_path / "demo.json"
    data.write_text(main.DATA_FILE.read_text(encoding="utf-8"), encoding="utf-8")
    monkeypatch.setattr(main, "DATA_FILE", data)  # the completion hook must not touch the real demo data
    return TestClient(main.app)


# ---------------------------------------------------------------- validators accept the starter items

@pytest.mark.parametrize("lang", ["en", "ar"])
def test_starter_items_pass_validation(lang):
    for x in BANK[lang]["lexical"]:
        generator.validate_lexical(x, lang, x["difficulty"], x["is_real_word"])
    for act in ("sound", "spelling", "comprehension", "reasoning"):
        for x in BANK[lang][act]:
            generator.VALIDATORS[act](x, lang, x["difficulty"])


def test_validators_reject_bad_items():
    ok_sound = dict(BANK["en"]["sound"][0])
    with pytest.raises(generator.ValidationError):
        generator.validate_sound({**ok_sound, "correct_index": 1}, "en", 1)   # wrong answer marked correct
    with pytest.raises(generator.ValidationError):
        generator.validate_lexical({"stimulus": "gar'den", "is_real_word": True}, "en", 1, True)  # quote / injection
    with pytest.raises(generator.ValidationError):
        generator.validate_lexical({"stimulus": "garden", "is_real_word": False}, "en", 1, True)  # label mismatch
    with pytest.raises(generator.ValidationError):
        generator.validate_reasoning({"question": "5 pens cost 2 AED each. Total?", "expression": "5*2", "answer_kind": "number",
                                      "options": ["7", "12", "15"], "correct_index": 0}, "en", 1)  # no option equals 10
    with pytest.raises(generator.ValidationError):
        generator.validate_reasoning({"question": "3 + 3?", "expression": "3+3", "answer_kind": "number",
                                      "options": ["6", "6.0", "7"], "correct_index": 0}, "en", 1)  # two options equal the answer


def test_safe_eval_only_does_arithmetic():
    assert generator.safe_eval("(9*60+20)+45") == 605
    assert generator.safe_eval("٧*٣") == 21
    for bad in ("__import__('os')", "2**100", "open('x')", "1/0"):
        with pytest.raises(generator.ValidationError):
            generator.safe_eval(bad)


# ---------------------------------------------------------------- number challenge: correct by construction

@pytest.mark.parametrize("lang", ["en", "ar"])
@pytest.mark.parametrize("skill", ["number_sense", "number_fact", "calculation"])
@pytest.mark.parametrize("level", [1, 2, 3])
def test_number_items_are_correct(lang, skill, level):
    rng = random.Random(7)
    for _ in range(200):
        it = generator.make_number_item(skill, level, lang, rng)
        opts = [to_western_digits(o) for o in it["options"]]
        assert len(set(opts)) == 3
        q = to_western_digits(it["question"])
        nums = [int(n) for n in re.findall(r"\d+", q)]
        right = opts[it["correct_index"]]
        if skill == "number_fact" or skill == "calculation":
            a, b = nums[-2], nums[-1]
            expected = a + b if "+" in q else a * b if "×" in q else a - b
            assert int(right) == expected
            assert all(int(o) != expected for i, o in enumerate(opts) if i != it["correct_index"])
        elif "closest" in q or "أقرب" in q:
            target = nums[0]
            dist = [abs(int(o) - target) for o in opts]
            assert dist.index(min(dist)) == it["correct_index"] and dist.count(min(dist)) == 1
        else:
            a, b = int(opts[0]), int(opts[1])
            assert it["correct_index"] == (0 if a > b else 1)


# ---------------------------------------------------------------- adaptive difficulty + evaluation

def test_next_level_staircase():
    assert next_level(1, True, 1000, 3000, False) == 2      # fast and right -> harder
    assert next_level(3, True, 1000, 3000, False) == 3      # capped
    assert next_level(2, True, 5000, 3000, False) == 2      # right but slow -> same
    assert next_level(2, False, 1000, 3000, False) == 1     # wrong -> easier
    assert next_level(2, None, None, 3000, True) == 1       # timeout -> easier
    assert next_level(1, False, 1000, 3000, False) == 1     # floor


def test_spelling_error_pattern():
    ops = edit_ops("receipt", "reciept")
    assert ops["transpositions"] == 1 and ops["distance"] == 1
    ops = edit_ops("rhythm", "rythm")
    assert ops["omissions"] == 1


def test_evaluation_is_deterministic():
    lex = {"activity": "lexical", "key": {"stimulus": "marn", "is_real_word": False}, "skill": "lexical_decision"}
    assert evaluation.evaluate(lex, 0, 900, False, None, "en") == {"correct": False, "timeout": False, "is_real_word": False, "error_type": "false_alarm"}
    num = {"activity": "number", "key": {"correct_index": 1}, "skill": "number_sense"}
    assert evaluation.evaluate(num, 1, 4000, False, None, "en")["correct"] is True
    late = evaluation.evaluate(num, 1, 8000 + 2000, False, None, "en")   # 8 s limit + grace exceeded
    assert late["timeout"] is True and late["correct"] is False
    spl = {"activity": "spelling", "key": {"word": "مسؤول", "spoken": "مَسْؤُول"}, "skill": "spelling_to_dictation"}
    assert evaluation.evaluate(spl, "مَسْؤُول", 3000, False, None, "ar")["correct"] is True  # diacritics ignored


# ---------------------------------------------------------------- LLM path (faked) with validation + fallback

class _S:  # minimal session for generator.generate
    def __init__(self, lang="en"):
        self.language, self.used, self.used_list, self.rng = lang, {}, {}, random.Random(1)
        self.lexical_plan = [True, False, True, False, True, False]


async def test_llm_item_is_used_when_valid(fake_llm):
    fake_llm.append({"word": "dap", "remove": "d", "position": "initial", "options": ["ap", "da", "dap"],
                     "correct_index": 0, "distractor_types": ["correct", "wrong_sound_removed", "no_change"]})
    item = await generator.generate(_S(), "sound", 1, 0)
    assert item["source"] == "llm" and item["public"]["word"] == "dap"
    assert "correct_index" not in item["public"]   # answer key stays on the server


async def test_invalid_then_repeated_llm_items_fall_back_to_bank(fake_llm):
    s = _S()
    bad = {"stimulus": "garden", "is_real_word": False}           # label mismatch for want_real=True
    fake_llm.extend([bad, bad])
    item = await generator.generate(s, "lexical", 1, 0)
    assert item["source"] == "bank"
    fake_llm.extend([{"stimulus": item["key"]["stimulus"], "is_real_word": item["key"]["is_real_word"]}] * 2)
    again = await generator.generate(s, "lexical", 1, 0)            # a repeat is rejected too
    assert again["key"]["stimulus"] != item["key"]["stimulus"]


async def test_writing_rubric_validated(fake_llm):
    fake_llm.append({"grammar": 3, "punctuation": 2, "organization": 4, "clarity": 3, "grammar_errors": 2,
                     "punctuation_errors": 3, "spelling_errors": 1, "note": "Some run-on sentences."})
    out = await evaluation.score_writing("prompt", "It should have desks. And quiet.", "en")
    assert out["status"] == "scored" and out["punctuation"] == 2
    fake_llm.append({"grammar": 9, "punctuation": 2, "organization": 4, "clarity": 3, "grammar_errors": 2,
                     "punctuation_errors": 3, "spelling_errors": 1, "note": ""})
    assert (await evaluation.score_writing("prompt", "text", "en"))["status"] == "not_scored"


async def test_writing_not_scored_without_llm(no_llm):
    assert (await evaluation.score_writing("prompt", "Some text.", "en"))["status"] == "not_scored"


# ---------------------------------------------------------------- classifier interface

def test_unconfigured_classifier_makes_no_decision():
    out = classifier.UnconfiguredClassifier().predict({})
    assert out.status == "model_not_connected" and out.outputs == {}


def test_json_model_gives_independent_multilabel_outputs(tmp_path):
    feats = ["lexical_acc", "math_calculation_acc"]
    model = {"labels": ["reading", "writing", "math"], "features": feats, "mean": [0.5, 0.5], "scale": [0.1, 0.1],
             "coef": [[-3, 0], [0, 0], [0, -3]], "intercept": [0, -5, 0], "version": "test-1"}
    path = tmp_path / "m.json"
    path.write_text(json.dumps(model))
    out = classifier.JsonLogisticClassifier(str(path)).predict({"lexical_acc": 0.2, "math_calculation_acc": 0.1})
    assert out.outputs["reading"].positive and out.outputs["math"].positive and not out.outputs["writing"].positive


# ---------------------------------------------------------------- full session over HTTP (LLM off)

@pytest.mark.parametrize("lang", ["en", "ar"])
def test_full_session_api(client, no_llm, lang, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "CLASSIFIER_FACTORY", "none")  # this test covers the "no model connected" path
    s = client.post("/api/screening/sessions", json={"language": lang, "context": {"hearing": True}}).json()
    sid, plan = s["session_id"], s["plan"]
    assert plan == {a: v["trials"] for a, v in ACTIVITIES.items()}

    def item(a):
        r = client.post(f"/api/screening/sessions/{sid}/items", json={"activity": a})
        assert r.status_code == 200, r.text
        body = r.json()
        assert not {"correct_index", "is_real_word", "expression", "key"} & set(body)  # no answer keys in the browser
        return body

    def answer(it, **kw):
        r = client.post(f"/api/screening/sessions/{sid}/answers", json={"item_id": it["item_id"], **kw})
        assert r.status_code == 200, r.text
        return r.json()

    for _ in range(plan["lexical"]):
        answer(item("lexical"), response=0, latency_ms=1200)
    for _ in range(plan["sound"]):
        answer(item("sound"), response=0, latency_ms=4000, audio_plays=2)
    for _ in range(plan["spelling"]):
        it = item("spelling")
        answer(it, response=it["spoken"], latency_ms=5000)
    w = item("writing")
    answer(w, response="It should include quiet desks and good lighting. Students can focus better there.", latency_ms=60000)
    c = item("comprehension")
    for q in range(4):
        answer(c, response=0, question_index=q, latency_ms=3000)
    for i in range(plan["number"]):
        it = item("number")
        assert "time_limit_s" in it
        answer(it, response=None if i == 0 else 0, timeout=i == 0, latency_ms=8000 if i == 0 else 2000)
    for _ in range(plan["reasoning"]):
        answer(item("reasoning"), response=1, latency_ms=10000)

    assert client.post(f"/api/screening/sessions/{sid}/items", json={"activity": "lexical"}).status_code == 409
    assert client.post(f"/api/screening/sessions/{sid}/answers", json={"item_id": w["item_id"], "response": "x"}).status_code == 409

    done = client.post(f"/api/screening/sessions/{sid}/complete",
                       json={"history": {"reading": 2, "math": None}, "passage_reading_ms": 30000}).json()
    f = done["features"]
    assert list(f) == FEATURE_NAMES
    assert f["lexical_n"] == 6 and f["spelling_acc"] == 1.0 and f["math_number_sense_timeouts"] == 1
    assert f["writing_scored"] == 0 and f["writing_words"] > 5 and f["history_reading"] == 2
    assert f["assessment_language_ar"] == (1 if lang == "ar" else 0)
    assert done["classification"]["status"] == "model_not_connected"
    support = client.get("/api/lexpace/profile").json()   # no model: base lesson, marked pending
    assert support["version"] == "base" and support["source"] == "screening_pending"
    saved = list((tmp_path / "sessions").glob("*.json"))
    assert len(saved) == 1 and "correct_index" not in saved[0].read_text(encoding="utf-8")
