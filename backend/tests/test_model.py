"""Tests for the bundled trained model (screening/sklearn_model.py) and its hand-off to the results page.

Needs scikit-learn (pinned in backend/requirements.txt); skipped otherwise.
"""

import math
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # backend/ on the import path

pytest.importorskip("sklearn")
from fastapi.testclient import TestClient  # noqa: E402

from screening import classifier, config, llm, sklearn_model  # noqa: E402
from screening.activities import ACTIVITIES  # noqa: E402


class FakeSession:
    language = "en"
    writing_eval = {"status": "scored", "grammar": 3, "punctuation": 2, "organization": 3, "clarity": 4}
    history = {"reading": 2, "spelling": 0, "math": None}

    def __init__(self, trials):
        self.trials = trials


def trial(activity, correct, difficulty, latency_ms, skill=None, timeout=False):
    return {"activity": activity, "skill": skill, "correct": correct, "difficulty": difficulty,
            "latency_ms": latency_ms, "timeout": timeout}


def test_row_follows_the_generator_formulas():
    s = FakeSession([trial("lexical", True, 1, 1000), trial("lexical", False, 2, 3000), trial("lexical", True, 2, 2000),
                     trial("number", False, 1, 8000, skill="number_sense", timeout=True),
                     trial("number", True, 1, 2000, skill="number_sense")])
    row = sklearn_model.build_row(s)
    assert row["word_recognition_accuracy"] == round(2 / 3, 4)
    assert row["word_recognition_mean_rt_s"] == 2.0
    assert row["word_recognition_difficulty_adjusted_accuracy"] == round((1 * 1 + 1 * 2) / (1 + 2 + 2), 4)
    assert row["word_recognition_level2_count"] == 2 and row["word_recognition_level3_count"] == 0
    assert math.isnan(row["word_recognition_level3_accuracy"])
    # timed-out answers count as wrong and are left out of the response-time statistics
    assert row["number_sense_timeout_rate"] == 0.5 and row["number_sense_mean_rt_s"] == 2.0
    assert math.isnan(row["number_sense_sd_rt_s"])  # one observation: no SD, as in the training data
    assert math.isnan(row["sound_lab_accuracy"]) and row["sound_lab_level1_count"] == 0
    assert row["writing_clarity_score"] == 4
    assert (row["childhood_reading_history"], row["childhood_writing_history"], row["childhood_math_history"]) == ("yes", "no", "unknown")


def test_model_columns_are_all_computed_and_outputs_are_independent():
    model = sklearn_model.load()
    row = sklearn_model.build_row(FakeSession([trial("lexical", True, 2, 1500)]))
    assert set(model.columns) <= set(row)
    out = model.predict({}, session=FakeSession([trial("lexical", True, 2, 1500)]))
    assert out.status == "ok" and set(out.outputs) == {"reading", "writing", "math"}
    assert all(0 <= o.probability <= 1 for o in out.outputs.values())
    assert model.predict({}).status == "error"  # needs the session's trials


def test_full_session_with_model_reaches_the_results_page(tmp_path, monkeypatch):
    import main
    monkeypatch.setattr(llm, "enabled", lambda: False)
    monkeypatch.setattr(config, "SESSIONS_DIR", tmp_path / "sessions")
    monkeypatch.setattr(config, "CLASSIFIER_FACTORY", "")
    monkeypatch.setattr(config, "CLASSIFIER_MODEL_PATH", "")
    monkeypatch.setattr(classifier, "_classifier", None)
    data = tmp_path / "demo.json"
    data.write_text(main.DATA_FILE.read_text(encoding="utf-8"), encoding="utf-8")
    monkeypatch.setattr(main, "DATA_FILE", data)
    client = TestClient(main.app)

    sid = client.post("/api/screening/sessions", json={"language": "en", "context": {}}).json()["session_id"]

    def play(activity, n, **answer):
        for _ in range(n):
            it = client.post(f"/api/screening/sessions/{sid}/items", json={"activity": activity}).json()
            if activity == "comprehension":
                for q in range(4):
                    client.post(f"/api/screening/sessions/{sid}/answers", json={"item_id": it["item_id"], "question_index": q, **answer})
            else:
                client.post(f"/api/screening/sessions/{sid}/answers", json={"item_id": it["item_id"], **answer})

    for a in ("lexical", "sound", "comprehension", "number", "reasoning"):
        play(a, ACTIVITIES[a]["trials"], response=1, latency_ms=6000)
    play("spelling", ACTIVITIES["spelling"]["trials"], response="zzz", latency_ms=9000)
    play("writing", 1, response="a short text", latency_ms=60000)
    done = client.post(f"/api/screening/sessions/{sid}/complete", json={"history": {"reading": 3, "spelling": 3, "math": 3}}).json()

    c = done["classification"]
    assert c["status"] == "ok" and c["model"].startswith("lexpace_logistic_regression")
    assert set(c["outputs"]) == {"reading", "writing", "math"}
    check = client.get("/api/lexpace/check").json()  # what the Blackboard results page shows
    assert check["status"] == "ok"
    assert {k: check[k] for k in ("reading", "writing", "math")} == {k: c["outputs"][k]["positive"] for k in ("reading", "writing", "math")}
    assert list(done["features"])[:1] == ["assessment_language_ar"]  # the v1 feature vector is unchanged
