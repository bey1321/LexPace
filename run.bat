@echo off
rem LexPace in Blackboard: one-command demo (Windows). Open http://localhost:8000 when it says "Demo ready".
cd /d "%~dp0"
where python >nul 2>nul
if %errorlevel%==0 (
  python run.py %*
) else (
  py -3 run.py %*
)
