#!/bin/bash
# Serverda: bitta kirish nuqtasi — backend ichidagi deploy_phonix.sh (pull, migrate, frontend build, restart, nginx).
# Ishlatish: bash deploy_server_now.sh  (yoki: cd /phonix/backend && git pull origin master && bash deploy_phonix.sh)
set -e
DEPLOY_DIR="${DEPLOY_DIR:-/phonix}"
cd "${DEPLOY_DIR}/backend"
git pull origin master || git pull origin main
exec bash deploy_phonix.sh
