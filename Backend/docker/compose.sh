#!/usr/bin/env bash
# Run Docker Compose for FixFlow with an explicit env-file path.
# Usage:
#   ./compose.sh --env-file /absolute/path/to/docker.env -p fixflow-local up -d --build
#   COMPOSE_ENV_FILE=/path/to/docker.env ./compose.sh config --quiet
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${COMPOSE_ENV_FILE:-}"

if [[ "${1:-}" == "--env-file" ]]; then
  if [[ -z "${2:-}" ]]; then
    echo "Missing path after --env-file" >&2
    exit 1
  fi
  ENV_FILE="$2"
  shift 2
fi

if [[ -z "$ENV_FILE" ]]; then
  if [[ -f "$ROOT/docker.env" ]]; then
    ENV_FILE="$ROOT/docker.env"
  else
    ENV_FILE="$ROOT/compose.env.example"
  fi
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found: $ENV_FILE (pass --env-file PATH or set COMPOSE_ENV_FILE)" >&2
  exit 1
fi

if [[ "$#" -eq 0 ]]; then
  echo "Pass Compose arguments, e.g. ./compose.sh --env-file ./docker.env up -d" >&2
  exit 1
fi

echo "Using env file: $ENV_FILE"
exec docker compose --project-directory "$ROOT" --env-file "$ENV_FILE" "$@"
