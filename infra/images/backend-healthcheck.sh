#!/usr/bin/env bash

set -Eeuo pipefail

exec 3<>/dev/tcp/127.0.0.1/8080
printf 'GET /q/health/ready HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n' >&3
IFS= read -r status_line <&3
status_line="${status_line%$'\r'}"
[[ "$status_line" == HTTP/*" 200 "* ]]
