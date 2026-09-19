#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
if ! command -v mongosh >/dev/null 2>&1 && ! command -v brew >/dev/null 2>&1; then echo "MongoDB client not found. Install MongoDB or use MongoDB Atlas."; fi
export MONGODB_URI="${MONGODB_URI:-mongodb://127.0.0.1:27017/ucd_sih26129}"
cleanup(){ kill 0 2>/dev/null || true; }; trap cleanup EXIT INT TERM
(cd "$ROOT/license-service" && node server.js) &
(cd "$ROOT/land-service" && node server.js) &
(cd "$ROOT/tax-service" && node server.js) &
(cd "$ROOT/gateway-service" && node server.js) &
(cd "$ROOT/citizen-dashboard" && npm run dev -- --host 0.0.0.0) &
wait
