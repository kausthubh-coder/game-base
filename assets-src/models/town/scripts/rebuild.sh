#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
"${BLENDER:-blender}" -b --python-exit-code 1 -t "${BLENDER_THREADS:-4}" --python scripts/build_export.py -- "$@"
