#!/usr/bin/env bash

set -u

read -r -p "Bin ID: " BIN_ID
read -r -s -p "X-Access-Key: " ACCESS_KEY
printf '\n'

if [[ -z "$BIN_ID" || -z "$ACCESS_KEY" ]]; then
  printf 'Bin ID e Access Key sono obbligatori.\n' >&2
  exit 1
fi

trap 'unset BIN_ID ACCESS_KEY' EXIT

curl -iS \
  -H "X-Access-Key: ${ACCESS_KEY}" \
  -H 'X-Bin-Meta: false' \
  -w '\nHTTP_STATUS:%{http_code}\n' \
  "https://api.jsonbin.io/v3/b/${BIN_ID}/latest"
