#!/bin/bash
# Serverda: bitta kirish nuqtasi — repo ildizidagi deploy_phonix.sh (git yangilash, migrate,
# frontend build, systemd restart). GitHub Actions ham aynan shu skriptni ishlatadi.
# Ishlatish: bash deploy_server_now.sh
set -e
DEPLOY_DIR="${DEPLOY_DIR:-/phonix}"
cd "${DEPLOY_DIR}"
export PHONIX_GIT_RESET="${PHONIX_GIT_RESET:-true}"
exec bash deploy_phonix.sh
