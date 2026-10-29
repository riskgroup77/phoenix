#!/bin/bash
# Serverda: bitta kirish nuqtasi — deploy_docker.sh (git yangilash, docker compose build/up, migrate,
# frontend build, nginx). GitHub Actions ham aynan shu skriptni ishlatadi.
# Ishlatish: bash deploy_server_now.sh
set -e
export PHOENIX_DIR="${PHOENIX_DIR:-/home/phoenix}"
exec bash "${PHOENIX_DIR}/deploy_docker.sh"
