#!/usr/bin/env python3
"""
To'liq oqim: backend + frontend (master) commit/push, keyin serverda pull + deploy_phonix.sh (migrate, frontend build, restart).

Muhit:
  PHONIX_SSH_PASSWORD  (majburiy, remote uchun)
  PHONIX_SSH_HOST      (ixtiyoriy, default 167.71.53.238)
  PHONIX_SSH_USER      (ixtiyoriy, default root)
  PHONIX_DEPLOY_MSG    (ixtiyoriy, commit xabari; bo'lmasa vaqt bilan avto)

Ishlatish:
  python scripts/full_deploy.py
  python scripts/full_deploy.py --message "fix: login"
  python scripts/full_deploy.py --remote-only
  python scripts/full_deploy.py --push-only
"""
from __future__ import annotations

import argparse
import datetime as _dt
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
REMOTE_DEPLOY = Path(__file__).resolve().parent / "remote_deploy.py"


def _run(
    args: list[str],
    cwd: Path | None = None,
    *,
    check: bool = True,
    capture: bool = False,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=str(cwd) if cwd else None,
        check=check,
        text=True,
        capture_output=capture,
    )


def _git_capture(args: list[str], cwd: Path) -> str:
    p = _run(["git", *args], cwd=cwd, check=True, capture=True)
    return (p.stdout or "").strip()


def _repo_branch(cwd: Path) -> str:
    return _git_capture(["rev-parse", "--abbrev-ref", "HEAD"], cwd)


def _repo_dirty(cwd: Path) -> bool:
    p = _run(["git", "status", "--porcelain"], cwd=cwd, check=True, capture=True)
    return bool((p.stdout or "").strip())


def _git_tracks_path(cwd: Path, path: str) -> bool:
    """Katta `git ls-files` chiqishidan qochish uchun ls-tree / error-unmatch."""
    t = _run(["git", "ls-tree", "HEAD", path], cwd=cwd, capture=True, check=False)
    if (t.stdout or "").strip():
        return True
    u = _run(["git", "ls-files", "--error-unmatch", path], cwd=cwd, capture=True, check=False)
    return u.returncode == 0


def _push_repo(
    name: str,
    cwd: Path,
    message: str,
    *,
    require_master: bool,
) -> None:
    if not cwd.is_dir():
        print(f"[o'tkazib] {name}: papka yo'q: {cwd}", file=sys.stderr)
        return
    try:
        _run(["git", "rev-parse", "--git-dir"], cwd=cwd, check=True, capture=True)
    except subprocess.CalledProcessError:
        print(f"[o'tkazib] {name}: git repo emas", file=sys.stderr)
        return

    branch = _repo_branch(cwd)
    if require_master and branch != "master":
        print(
            f"[xato] {name}: hozirgi branch '{branch}'. Server faqat origin/master ni tortadi. "
            "master ga o'ting yoki --allow-non-master bering (push qilinadi, lekin server yangilanmasligi mumkin).",
            file=sys.stderr,
        )
        raise SystemExit(1)

    if not _repo_dirty(cwd):
        print(f"[ok] {name}: o'zgarish yo'q, push kerak emas")
        return

    if name == "FRONTEND" and _git_tracks_path(cwd, "node_modules"):
        print(
            "[ogohlantirish] FRONTEND: node_modules git da — tavsiya: git rm -r --cached node_modules",
            file=sys.stderr,
        )
    if name == "BACKEND" and _git_tracks_path(cwd, ".env"):
        print(
            "[ogohlantirish] BACKEND: .env git da — maxfiylik uchun repodan olib tashlang.",
            file=sys.stderr,
        )

    print(f"[git] {name}: commit + push ({branch})...")
    # Yangi fayllar + o'chirilganlar; .gitignore dagilar kirmaydi
    _run(["git", "add", "-A"], cwd=cwd, check=True, capture=False)
    # 0 = staged o'zgarish yo'q
    if _run(["git", "diff", "--cached", "--quiet"], cwd=cwd, check=False).returncode == 0:
        print(f"[ok] {name}: commit qilinadigan staged fayl yo'q (.gitignore tufayli bo'lishi mumkin)")
        return
    _run(["git", "commit", "-m", message], cwd=cwd, check=True, capture=False)
    _run(["git", "push", "origin", branch], cwd=cwd, check=True, capture=False)
    print(f"[ok] {name}: push tugadi")


def _remote_deploy() -> int:
    use_agent = os.environ.get("PHONIX_SSH_USE_AGENT", "").lower() in ("1", "true", "yes", "on")
    if (
        not os.environ.get("PHONIX_SSH_PASSWORD")
        and not (os.environ.get("PHONIX_SSH_KEY") or "").strip()
        and not use_agent
    ):
        print(
            "[xato] Masofadan deploy: PHONIX_SSH_PASSWORD, PHONIX_SSH_KEY yoki PHONIX_SSH_USE_AGENT=1",
            file=sys.stderr,
        )
        return 2
    p = subprocess.run(
        [sys.executable, str(REMOTE_DEPLOY)],
        cwd=str(ROOT),
        env=os.environ.copy(),
    )
    return int(p.returncode)


def main() -> int:
    parser = argparse.ArgumentParser(description="Push backend/frontend + server pull/deploy")
    parser.add_argument(
        "--message",
        "-m",
        default="",
        help="Commit xabari (bir nechta repo uchun bir xil)",
    )
    parser.add_argument(
        "--remote-only",
        action="store_true",
        help="Faqat serverda pull + deploy (push qilmaslik)",
    )
    parser.add_argument(
        "--push-only",
        action="store_true",
        help="Faqat git push (serverga ulanmaslik)",
    )
    parser.add_argument(
        "--allow-non-master",
        action="store_true",
        help="master emas branchdan ham push qilishga ruxsat (server master tortadi)",
    )
    args = parser.parse_args()

    if args.remote_only and args.push_only:
        print("[xato] --remote-only va --push-only birga bo'lmaydi", file=sys.stderr)
        return 2

    msg = (args.message or os.environ.get("PHONIX_DEPLOY_MSG") or "").strip()
    if not msg:
        msg = f"deploy: auto {_dt.datetime.now().strftime('%Y-%m-%d %H:%M')}"

    require_master = not args.allow_non_master

    if not args.remote_only:
        try:
            _push_repo("BACKEND", BACKEND, msg, require_master=require_master)
            _push_repo("FRONTEND", FRONTEND, msg, require_master=require_master)
        except subprocess.CalledProcessError as e:
            print(f"[xato] git: {e}", file=sys.stderr)
            if e.stderr:
                print(e.stderr, file=sys.stderr)
            if e.stdout:
                print(e.stdout, file=sys.stderr)
            return 1

    if args.push_only:
        print("[ok] Push-only tugadi.")
        return 0

    code = _remote_deploy()
    if code != 0:
        return code
    print("\n[ok] To'liq deploy yakunlandi.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
