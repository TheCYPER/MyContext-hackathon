#!/bin/bash
set -euo pipefail
SOURCE=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
CONTEXT=${1:-${MY_CONTEXT_ROOT:-${MYCONTEXT_ROOT:-"$SOURCE/.local/demo"}}}
[ "$#" -le 1 ] || { echo 'usage: install-skills.sh [context-root]' >&2; exit 2; }
exec ruby "$SOURCE/scripts/install_skills.rb" "$SOURCE" "$CONTEXT"
