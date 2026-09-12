#!/bin/bash
set -euo pipefail
SOURCE=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
exec ruby "$SOURCE/scripts/install-global-skill.rb" "$@"
