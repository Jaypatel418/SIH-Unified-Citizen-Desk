#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
for dir in license-service land-service tax-service gateway-service citizen-dashboard; do
  echo "Installing $dir..."
  (cd "$ROOT/$dir" && npm install)
done
echo "Setup complete. Make sure MongoDB is running, then run ./start-all.sh"
