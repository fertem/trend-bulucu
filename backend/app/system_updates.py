"""Self-update + reset operations for the trend-bulucu dashboard.

Provides:
- check_for_updates(): git fetch + diff against origin/main
- apply_update(): git pull + pip install + npm install + schedule restart
- wipe_data(scope): three reset levels
- schedule_restart(): detached process that stops + starts the app
"""
from __future__ import annotations

import logging
import os
import platform
import shutil
import subprocess
import sys
import threading
from pathlib import Path
from typing import Literal

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
FRONTEND_DIR = PROJECT_ROOT / "frontend"


def _run(cmd: list[str], cwd: Path, timeout: int = 120) -> tuple[int, str, str]:
    """Run a command, return (exit_code, stdout, stderr)."""
    try:
        proc = subprocess.run(
            cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout,
            encoding="utf-8", errors="replace",
        )
        return proc.returncode, proc.stdout.strip(), proc.stderr.strip()
    except subprocess.TimeoutExpired:
        return -1, "", f"timeout after {timeout}s"
    except FileNotFoundError as e:
        return -2, "", f"command not found: {e}"


def _git(args: list[str], cwd: Path = PROJECT_ROOT, timeout: int = 60) -> tuple[int, str, str]:
    return _run(["git", *args], cwd=cwd, timeout=timeout)


def is_git_repo() -> bool:
    return (PROJECT_ROOT / ".git").exists()


def get_current_version() -> dict:
    """Current commit info."""
    if not is_git_repo():
        return {"is_git": False}
    code, out, _ = _git(["rev-parse", "HEAD"])
    short_code, short_out, _ = _git(["rev-parse", "--short", "HEAD"])
    branch_code, branch_out, _ = _git(["rev-parse", "--abbrev-ref", "HEAD"])
    msg_code, msg_out, _ = _git(["log", "-1", "--format=%s"])
    return {
        "is_git": True,
        "commit": out if code == 0 else None,
        "short": short_out if short_code == 0 else None,
        "branch": branch_out if branch_code == 0 else None,
        "subject": msg_out if msg_code == 0 else None,
    }


def check_for_updates() -> dict:
    """Run git fetch and report how far behind origin/main we are."""
    if not is_git_repo():
        return {
            "is_git": False,
            "error": "Project is not a git repository — manual install can't auto-update.",
        }

    # Refuse if there are uncommitted local changes that would block pull
    code, out, err = _git(["status", "--porcelain"])
    if code != 0:
        return {"error": f"git status failed: {err}"}
    has_local_changes = bool(out.strip())

    fetch_code, _, fetch_err = _git(["fetch", "origin"], timeout=90)
    if fetch_code != 0:
        return {"error": f"git fetch failed: {fetch_err}"}

    # Branch we're on (default main)
    _, branch, _ = _git(["rev-parse", "--abbrev-ref", "HEAD"])
    branch = branch or "main"

    # Behind / ahead counts
    code, out, err = _git(["rev-list", "--left-right", "--count", f"origin/{branch}...HEAD"])
    behind, ahead = 0, 0
    if code == 0 and out:
        try:
            parts = out.split()
            behind, ahead = int(parts[0]), int(parts[1])
        except Exception:
            pass

    # Changelog (subjects of commits we'd be pulling)
    changelog: list[dict] = []
    if behind > 0:
        code, out, _ = _git(["log", "--format=%h|%s|%an|%cI", f"HEAD..origin/{branch}"])
        if code == 0:
            for line in out.split("\n"):
                if not line.strip():
                    continue
                parts = line.split("|", 3)
                if len(parts) == 4:
                    changelog.append({
                        "hash": parts[0],
                        "subject": parts[1],
                        "author": parts[2],
                        "date": parts[3],
                    })

    # Detect dependency changes
    requirements_changed = False
    package_json_changed = False
    if behind > 0:
        code, out, _ = _git(["diff", "--name-only", f"HEAD..origin/{branch}"])
        if code == 0:
            files = set(out.split())
            requirements_changed = "backend/requirements.txt" in files
            package_json_changed = "frontend/package.json" in files

    current = get_current_version()

    return {
        "is_git": True,
        "branch": branch,
        "current": current,
        "behind": behind,
        "ahead": ahead,
        "has_local_changes": has_local_changes,
        "changelog": changelog,
        "requirements_changed": requirements_changed,
        "package_json_changed": package_json_changed,
        "update_available": behind > 0,
    }


def apply_update(install_deps: bool = True) -> dict:
    """Pull latest code, optionally install deps, then trigger restart."""
    if not is_git_repo():
        return {"status": "error", "error": "not a git repository"}

    # Refuse if local changes exist
    code, out, _ = _git(["status", "--porcelain"])
    if out.strip():
        return {
            "status": "error",
            "error": "uncommitted local changes — please review and commit/stash first",
        }

    log: list[str] = []

    # Pull
    code, out, err = _git(["pull", "--ff-only"], timeout=120)
    if code != 0:
        return {"status": "error", "error": f"git pull failed: {err}", "log": log}
    log.append(f"git pull: {out or 'up-to-date'}")

    # Reload check info after pull
    after = get_current_version()

    # Detect changed dep files (compare reflog before/after)
    if install_deps:
        # backend deps
        req_file = BACKEND_DIR / "requirements.txt"
        if req_file.exists():
            pip_exe = _backend_pip()
            if pip_exe:
                code, out, err = _run(
                    [str(pip_exe), "install", "-r", str(req_file), "--quiet"],
                    cwd=BACKEND_DIR, timeout=300,
                )
                if code == 0:
                    log.append("pip install: ok")
                else:
                    log.append(f"pip install: WARN — {err[:200]}")

        # frontend deps
        pkg_file = FRONTEND_DIR / "package.json"
        if pkg_file.exists() and shutil.which("npm"):
            code, out, err = _run(
                ["npm", "install", "--silent"],
                cwd=FRONTEND_DIR, timeout=300,
            )
            if code == 0:
                log.append("npm install: ok")
            else:
                log.append(f"npm install: WARN — {err[:200]}")

    # Schedule restart in 3 seconds
    schedule_restart(delay_seconds=3)

    return {
        "status": "restarting",
        "after": after,
        "log": log,
        "eta_seconds": 8,
    }


def _backend_pip() -> Path | None:
    """Find pip in the backend's virtualenv."""
    if platform.system() == "Windows":
        candidates = [
            BACKEND_DIR / "venv" / "Scripts" / "pip.exe",
            BACKEND_DIR / ".venv" / "Scripts" / "pip.exe",
        ]
    else:
        candidates = [
            BACKEND_DIR / "venv" / "bin" / "pip",
            BACKEND_DIR / ".venv" / "bin" / "pip",
        ]
    for c in candidates:
        if c.exists():
            return c
    return None


def schedule_restart(delay_seconds: int = 3) -> None:
    """Spawn a detached restart script and exit current process after delay."""
    is_windows = platform.system() == "Windows"
    script_name = "restart.bat" if is_windows else "restart.sh"
    script_path = PROJECT_ROOT / script_name

    if not script_path.exists():
        logger.error("restart script not found at %s", script_path)
        return

    try:
        if is_windows:
            DETACHED = 0x00000008
            CREATE_NEW_GROUP = 0x00000200
            subprocess.Popen(
                [str(script_path)],
                cwd=str(PROJECT_ROOT),
                creationflags=DETACHED | CREATE_NEW_GROUP,
                close_fds=True,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        else:
            subprocess.Popen(
                ["bash", str(script_path)],
                cwd=str(PROJECT_ROOT),
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
            )
        logger.info("restart scheduled — exiting in %ds", delay_seconds)
    except Exception as e:
        logger.exception("failed to spawn restart script: %s", e)
        return

    def _self_terminate():
        import time
        time.sleep(delay_seconds)
        logger.info("self-terminating for restart")
        os._exit(0)

    threading.Thread(target=_self_terminate, daemon=True).start()


# ───────────────────────── RESET / WIPE ──────────────────────────────

ResetScope = Literal["data", "data_and_settings", "all"]

# Tables that hold time-series / collected data (cleared in all scopes)
DATA_TABLES = [
    "trends_timeseries",
    "trends_related",
    "trends_rising",
    "trends_scores",
    "trends_historical",
    "trends_historical_runs",
    "trends_volume",
    "trends_runs",
    "sc_queries",
    "sc_syncs",
    "site_content",
    "content_gaps_history",
]

# Tables that hold user choices (cleared only in data_and_settings + all)
SETTINGS_TABLES = [
    "trends_keywords",
    "trend_categories",
    "app_settings",
]


def wipe_data(db: Session, scope: ResetScope) -> dict:
    """Wipe trend data and optionally settings.

    scope:
      "data"               — only collected data, keep keywords/categories/brand
      "data_and_settings"  — also keywords/categories/brand info (keep .env)
      "all"                — drop everything (DB file deleted, recreated)
    """
    from .db import engine, Base

    cleared: list[str] = []
    errors: list[str] = []

    if scope == "all":
        try:
            db.close()
        except Exception:
            pass
        try:
            Base.metadata.drop_all(engine)
            Base.metadata.create_all(engine)
            cleared.append("all tables")
        except Exception as e:
            errors.append(f"drop+recreate: {e}")
        return {"scope": scope, "cleared": cleared, "errors": errors}

    targets = list(DATA_TABLES)
    if scope == "data_and_settings":
        targets = list(DATA_TABLES) + list(SETTINGS_TABLES)

    # Run deletes in reverse dependency order — wrap each individually so one
    # failure doesn't kill the rest.
    for tname in targets:
        try:
            db.execute(text(f"DELETE FROM {tname}"))
            cleared.append(tname)
        except Exception as e:
            # Table might not exist (SQLite is forgiving) — log and continue
            errors.append(f"{tname}: {type(e).__name__}")
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        errors.append(f"commit: {e}")

    return {"scope": scope, "cleared": cleared, "errors": errors}
