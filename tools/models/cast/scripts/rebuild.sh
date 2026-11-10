#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
args=()
if [[ "${REGENERATE:-0}" == "1" ]]; then args+=(--regenerate); fi
"${BLENDER:-blender}" -b -t "${BLENDER_THREADS:-4}" --python scripts/build.py -- "${args[@]}"
python3 scripts/validate.py models --out qa/validation.json --markdown qa/validation.md
python3 validate_glb.py models --json qa/independent_validation.json --strict-size
"${BLENDER:-blender}" -b -t "${BLENDER_THREADS:-4}" --python scripts/review_all_motion.py
if python3 -c 'import PIL' >/dev/null 2>&1; then
 python3 scripts/compose_motion_review.py
fi
python3 scripts/make_readme.py
