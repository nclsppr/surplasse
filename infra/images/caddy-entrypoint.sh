#!/usr/bin/env sh

set -eu

secret_path="${DNS_API_TOKEN_FILE:-}"
if [ -n "${DNS_API_TOKEN:-}" ] && [ -n "$secret_path" ]; then
  printf 'Error: DNS_API_TOKEN and DNS_API_TOKEN_FILE cannot both be configured.\n' >&2
  exit 1
fi
if [ -n "$secret_path" ]; then
  if [ ! -f "$secret_path" ] || [ ! -r "$secret_path" ]; then
    printf 'Error: the DNS API token secret is missing or unreadable.\n' >&2
    exit 1
  fi
  DNS_API_TOKEN="$(cat "$secret_path")"
  export DNS_API_TOKEN
  unset DNS_API_TOKEN_FILE
fi

exec "$@"
