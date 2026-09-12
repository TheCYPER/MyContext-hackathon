#!/bin/bash
set -euo pipefail
SOURCE=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SNAPSHOT=$(mktemp -d "${TMPDIR:-/tmp}/mycontext-check.XXXXXX")
trap 'rm -rf -- "$SNAPSHOT"' EXIT

case "${1:---staged}" in
  --staged|--ci)
    git -C "$SOURCE" checkout-index --all --prefix="$SNAPSHOT/"
    ;;
  --tree)
    [ "$#" -eq 2 ] || { echo 'usage: check.sh [--staged|--ci|--tree <source>]' >&2; exit 2; }
    SOURCE=$(CDPATH= cd -- "$2" && pwd)
    # Copy tracked and non-ignored work files; local context never enters tests.
    ruby -rfileutils -ropen3 -e '
      root, dest = ARGV
      out, status = Open3.capture2("git", "-C", root, "ls-files", "--cached", "--others", "--exclude-standard", "-z")
      abort "check: source must be a Git worktree" unless status.success?
      out.split("\0").uniq.each do |rel|
        abort "check: unsafe path" if rel.split("/").include?("..") || rel.start_with?("/")
        path = File.join(root, rel)
        next unless File.exist?(path) || File.symlink?(path)
        target = File.join(dest, rel)
        FileUtils.mkdir_p(File.dirname(target))
        File.symlink?(path) ? File.symlink(File.readlink(path), target) : FileUtils.cp(path, target, preserve: true)
      end
    ' "$SOURCE" "$SNAPSHOT"
    ;;
  *) echo 'usage: check.sh [--staged|--ci|--tree <source>]' >&2; exit 2 ;;
esac

[ -f "$SNAPSHOT/package.json" ] || { echo 'check: no source snapshot; stage new files first' >&2; exit 1; }
for required in tests/setup.test.rb tests/install-skills.test.rb tests/retrieval.test.rb; do
  [ -f "$SNAPSHOT/$required" ] || { echo "check: required test is missing: $required" >&2; exit 1; }
done
ruby "$SNAPSHOT/scripts/public-check.rb" "$SNAPSHOT"
bash "$SNAPSHOT/scripts/secret-scan.sh" "$SNAPSHOT"
ruby "$SNAPSHOT/scripts/validate-skills.rb" "$SNAPSHOT"
ruby "$SNAPSHOT/scripts/validate.rb" --scaffold "$SNAPSHOT/examples/demo"
ruby "$SNAPSHOT/scripts/validate.rb" --scaffold "$SNAPSHOT/templates/context"
for test_file in "$SNAPSHOT"/tests/*.rb; do
  [ ! -f "$test_file" ] || ruby "$test_file"
done
for test_file in "$SNAPSHOT"/tests/*.sh; do
  [ ! -f "$test_file" ] || bash "$test_file" "$SNAPSHOT"
done
npm --prefix "$SNAPSHOT/dashboard" ci --ignore-scripts
npm --prefix "$SNAPSHOT/dashboard" run test:run
npm --prefix "$SNAPSHOT/dashboard" run build
node --test "$SNAPSHOT"/dashboard/test/*.test.mjs
echo 'check: OK (source boundary, templates, setup, retrieval, installation, dashboard build and tests)'
