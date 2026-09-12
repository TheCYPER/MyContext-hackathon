#!/bin/bash
set -euo pipefail
SOURCE=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
CONTEXT=${1:-${MY_CONTEXT_ROOT:-${MYCONTEXT_ROOT:-"$SOURCE/.local/demo"}}}
[ "$#" -le 1 ] || { echo 'usage: validate.sh [context-root]' >&2; exit 2; }
TOP=$(git -C "$CONTEXT" rev-parse --show-toplevel)
[ "$(cd "$TOP" && pwd -P)" = "$(cd "$CONTEXT" && pwd -P)" ] || { echo 'validate: context must be a Git root' >&2; exit 1; }
SNAPSHOT=$(mktemp -d "${TMPDIR:-/tmp}/mycontext-validate.XXXXXX")
trap 'rm -rf -- "$SNAPSHOT"' EXIT
git -C "$CONTEXT" checkout-index --all --prefix="$SNAPSHOT/"
ruby "$SOURCE/scripts/validate.rb" "$SNAPSHOT"
ruby "$SOURCE/scripts/secret_scan.rb" "$SNAPSHOT"
echo 'validate: staged context snapshot OK; unstaged changes were not validated'
