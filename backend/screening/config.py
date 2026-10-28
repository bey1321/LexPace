"""Settings for the screening pipeline, read from the environment (and a local .env file).

API keys stay on the backend: they are read here and never sent to the browser.
"""

import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent


def _load_dotenv() -> None:
    """Minimal .env loader (repo root, then backend/). Existing env vars win."""
    for path in (ROOT_DIR / ".env", BACKEND_DIR / ".env"):
        if not path.is_file():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv()

# LLM (question generation + written-expression scoring). Without a key the pipeline
# serves the validated starter items instead, so the demo also works offline.
LLM_MODEL = os.environ.get("LEXPACE_LLM_MODEL", "claude-opus-5-5")
LLM_ENABLED = os.environ.get("LEXPACE_LLM", "1") != "0" and bool(
    os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")
)
LLM_TIMEOUT_S = float(os.environ.get("LEXPACE_LLM_TIMEOUT", "45"))
# Server-side refusal fallback (beta). Set LEXPACE_LLM_FALLBACKS=0 to turn it off.
LLM_FALLBACKS = os.environ.get("LEXPACE_LLM_FALLBACKS", "1") != "0"

# Trained classifier: path to an exported multi-label model (see classifier.py).
CLASSIFIER_MODEL_PATH = os.environ.get("LEXPACE_CLASSIFIER_MODEL", "")
# Or a Python factory "package.module:function" returning a ScreeningClassifier.
CLASSIFIER_FACTORY = os.environ.get("LEXPACE_CLASSIFIER", "")

# Completed sessions (features + raw trials) are written here for model training.
SESSIONS_DIR = BACKEND_DIR / "data" / "screening_sessions"
MAX_LIVE_SESSIONS = 500
