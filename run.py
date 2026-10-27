"""One-command demo launcher (called by run.bat / run.sh).

Installs dependencies, builds the React shell, starts the training app's Node server and
FastAPI together, and stops both on Ctrl+C or when either one exits.

  python run.py                 full run
  python run.py --skip-install  skip pip/npm install (offline at the venue, after one full run)
  python run.py --skip-build    reuse the existing frontend/dist
"""

import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FRONTEND = ROOT / "frontend"
TRAINING = ROOT / "Training" / "LexPace"
PORT = int(os.environ.get("PORT", "8000"))
TRAINING_PORT = int(os.environ.get("TRAINING_PORT", "3000"))


def step(msg):
    print(f"\n==> {msg}", flush=True)


def run(cmd, cwd=ROOT):
    subprocess.run(cmd, cwd=cwd, check=True)


def main():
    args = set(sys.argv[1:])
    npm = shutil.which("npm")
    node = shutil.which("node")
    if not npm or not node:
        sys.exit("Node.js (with npm) is required: https://nodejs.org")

    if "--skip-install" not in args:
        step("Installing Python packages")
        run([sys.executable, "-m", "pip", "install", "-q", "-r", str(ROOT / "backend" / "requirements.txt")])
        step("Installing frontend packages")
        run([npm, "install", "--no-audit", "--no-fund"], cwd=FRONTEND)
        step("Installing LexPace Training packages")
        run([npm, "install", "--no-audit", "--no-fund"], cwd=TRAINING)

    if "--skip-build" not in args:
        step("Building the Blackboard shell")
        run([npm, "run", "build"], cwd=FRONTEND)

    step(f"Starting LexPace Training on port {TRAINING_PORT} and FastAPI on port {PORT}")
    procs = [
        subprocess.Popen([node, "src/server.js"], cwd=TRAINING, env={**os.environ, "PORT": str(TRAINING_PORT)}),
        subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "main:app", "--app-dir", str(ROOT / "backend"), "--host", "127.0.0.1", "--port", str(PORT)],
            cwd=ROOT, env={**os.environ, "TRAINING_URL": f"http://127.0.0.1:{TRAINING_PORT}"},
        ),
    ]
    print(f"\n    Demo ready:  http://localhost:{PORT}\n    Press Ctrl+C to stop.\n", flush=True)
    try:
        while all(p.poll() is None for p in procs):
            time.sleep(0.5)
        print("A server exited; stopping the other one.")
    except KeyboardInterrupt:
        print("\nStopping...")
    finally:
        for p in procs:
            if p.poll() is None:
                p.terminate()
        for p in procs:
            try:
                p.wait(timeout=5)
            except subprocess.TimeoutExpired:
                p.kill()


if __name__ == "__main__":
    main()
