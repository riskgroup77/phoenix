#!/usr/bin/env bash
# Push backend va frontend (parent Phonix papkasidan).
# chmod +x scripts/push_repos.sh && ./scripts/push_repos.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

push_repo() {
  local name="$1"
  local path="$2"
  echo ""
  echo "=== $name ==="
  cd "$path"
  if [[ -z "$(git status --porcelain)" ]]; then
    echo "O'zgarish yo'q."
    return 0
  fi
  git status
  read -r -p "Commit xabari: " msg
  if [[ -z "${msg// }" ]]; then
    echo "Bekor."
    exit 1
  fi
  git add -A
  git commit -m "$msg"
  branch="${BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"
  git push origin "$branch"
}

push_repo "BACKEND" "$ROOT/backend"
push_repo "FRONTEND" "$ROOT/frontend"
echo ""
echo "Tayyor. Serverda: cd /phonix/backend && git pull origin master && bash deploy_phonix.sh"
