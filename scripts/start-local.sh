#!/usr/bin/env bash

set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-8789}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  printf 'File environment non trovato: %s\n' "$ENV_FILE" >&2
  exit 1
fi

while IFS= read -r line || [[ -n "$line" ]]; do
  case "$line" in
    JSONBIN_BIN_ID=*) BIN_ID=${line#*=} ;;
    JSONBIN_API_KEY=*) ACCESS_KEY=${line#*=} ;;
  esac
done < "$ENV_FILE"

for variable in BIN_ID ACCESS_KEY; do
  value=${!variable-}
  if [[ "$value" == \"*\" && "$value" == *\" ]]; then
    value=${value:1:${#value}-2}
  elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
    value=${value:1:${#value}-2}
  fi
  printf -v "$variable" '%s' "$value"
done

if [[ -z "$BIN_ID" || -z "$ACCESS_KEY" ]]; then
  printf 'JSONBIN_BIN_ID e JSONBIN_API_KEY devono essere presenti in %s.\n' "$ENV_FILE" >&2
  exit 1
fi

trap 'unset BIN_ID ACCESS_KEY' EXIT

cd "$ROOT_DIR"
exec wrangler pages dev . \
  --port "$PORT" \
  --binding "JSONBIN_BIN_ID=${BIN_ID}" \
  --binding "JSONBIN_API_KEY=${ACCESS_KEY}"
