# frozen_string_literal: true

require "minitest/autorun"
require "tmpdir"
require "fileutils"
require "open3"
require "json"
require "digest"
require "rbconfig"

class ContextCaptureTest < Minitest::Test
  SOURCE = File.expand_path("..", __dir__)
  CAPTURE = File.join(SOURCE, "scripts", "capture-context.rb")
  ENVIRONMENT = {
    "MY_CONTEXT_ROOT" => nil, "MYCONTEXT_ROOT" => nil, "MY_CONTEXT_CONFIG" => nil,
    "GIT_CONFIG_GLOBAL" => File::NULL, "GIT_CONFIG_NOSYSTEM" => "1", "GIT_CONFIG_SYSTEM" => File::NULL
  }.freeze

  def setup
    @tmp = Dir.mktmpdir("mycontext-capture-test-")
    @root = File.join(@tmp, "context")
    @state = File.join(@tmp, "state")
    @config = File.join(@tmp, "config.json")
    FileUtils.mkdir_p(File.join(@root, "profile"))
    FileUtils.mkdir_p(File.join(@root, "meta"))
    File.write(File.join(@root, "AGENTS.md"), "# Fixture instructions\n")
    File.write(File.join(@root, "INDEX.md"), "# Fixture context\n")
    File.write(File.join(@root, "meta", "schema.md"), "# Fixture schema\n")
    File.write(File.join(@root, "meta", "write-policy.md"), "# Fixture capture policy\n")
    File.write(File.join(@root, ".gitignore"), ".codex/\nsources/\n")
    File.write(File.join(@root, "profile", "summary.md"), <<~MD)
      ---
      id: profile.summary
      type: profile
      title: Synthetic owner
      privacy: private
      updated: "2026-09-12T00:00:00Z"
      sources: ["demo:fictional"]
      aliases: []
      tags: []
      links: []
      status: active
      ---

      Fictional fixture only.
    MD
    git("init", "-b", "main")
    git("add", ".")
    git("commit", "-m", "Fixture context")
    @original = head
  end

  def teardown
    FileUtils.remove_entry(@tmp)
  end

  def git(*args)
    output, error, status = Open3.capture3(ENVIRONMENT, "git", "-C", @root,
      "-c", "user.name=Capture Test", "-c", "user.email=capture-test@example.invalid",
      "-c", "commit.gpgsign=false", "-c", "core.hooksPath=#{File::NULL}", *args)
    assert status.success?, error
    output.strip
  end

  def head
    git("rev-parse", "HEAD")
  end

  def payload(event = "session-fixture-event-1")
    { "version" => 1, "event_id" => event, "title" => "A bounded result", "date" => "2026-09-12",
      "facts" => [
        { "text" => "The fixture comparison is incomplete.", "evidence" => "user_confirmed", "source" => "session:codex:fixture" },
        { "text" => "More evidence may change the conclusion.", "evidence" => "inference", "source" => "session:codex:fixture" }
      ], "links" => ["profile.summary"] }
  end

  def input_file(data, suffix = "input")
    path = File.join(@tmp, "#{suffix}.json")
    File.write(path, data.is_a?(String) ? data : JSON.generate(data))
    path
  end

  def command_args(command, input = nil)
    [command, "--root", @root, "--config", @config, "--state-dir", @state] + (input ? ["--input", input] : [])
  end

  def run_capture(data = payload, env: {}, ruby_hook: nil)
    input = input_file(data, "input-#{Thread.current.object_id}")
    args = command_args("capture", input)
    command = ruby_hook ? [RbConfig.ruby, "-r", CAPTURE, "-e", ruby_hook, *args] : [RbConfig.ruby, CAPTURE, *args]
    out, err, status = Open3.capture3(ENVIRONMENT.merge(env), *command)
    assert_empty err, "CLI should return redacted structured errors"
    [JSON.parse(out), status, out]
  end

  def cli(command)
    out, err, status = Open3.capture3(ENVIRONMENT, RbConfig.ruby, CAPTURE, *command_args(command))
    assert status.success?, err
    JSON.parse(out)
  end

  def enable
    policy = {
      "version" => 1, "mode" => "append_journal", "commit" => "local",
      "write_policy_sha256" => Digest::SHA256.file(File.join(@root, "meta", "write-policy.md")).hexdigest,
      "agents_sha256" => Digest::SHA256.file(File.join(@root, "AGENTS.md")).hexdigest
    }
    File.write(File.join(@root, "meta", "capture-policy.json"), JSON.generate(policy) + "\n")
    git("add", "meta/capture-policy.json")
    git("commit", "-m", "Enable fixture capture")
  end

  def notes
    Dir.glob(File.join(@root, "journal", "**", "*.md"))
  end

  def test_default_review_queues_outside_context_and_lists_no_fact_text
    result, status = run_capture
    assert status.success?
    assert_equal "queued", result["outcome"]
    assert_equal "no_committed_policy", result["reason"]
    assert_equal @original, head
    assert_empty notes
    assert_equal "", git("status", "--porcelain")
    assert_equal "review", cli("status")["mode"]
    listed = cli("list")["items"]
    assert_equal 1, listed.length
    assert_equal "queued", listed.first["state"]
    refute JSON.generate(listed).include?("comparison is incomplete")
    Dir.glob(File.join(@state, "**", "{payload.json,candidate.md,receipt.json}")).each do |path|
      assert_equal 0, File.stat(path).mode & 0o077
    end
    replay, = run_capture
    assert_equal "queued", replay["outcome"]
    assert_equal 1, cli("list")["items"].length
    enable
    captured, = run_capture
    assert_equal "committed", captured["outcome"]
    assert_equal 1, notes.length
  end

  def test_auto_capture_is_one_private_note_one_commit_and_retries_are_idempotent
    enable
    before = head
    # A capture may not execute configured hooks.
    hook = File.join(@root, ".git", "hooks", "post-commit")
    File.write(hook, "#!/bin/sh\ntouch '#{File.join(@tmp, 'hook-ran')}'\n")
    File.chmod(0o755, hook)
    result, status = run_capture
    assert status.success?
    assert_equal true, result["ok"]
    assert_equal "committed", result["outcome"]
    assert_equal false, result["pushed"]
    refute File.exist?(File.join(@tmp, "hook-ran"))
    assert_equal result["commit"], head
    assert_equal "1", git("rev-list", "--count", "#{before}..HEAD")
    assert_equal "A\t#{result['path']}", git("diff-tree", "--no-commit-id", "--name-status", "-r", "HEAD")
    assert_equal "", git("status", "--porcelain")
    assert_equal "", git("remote")
    text = File.read(notes.first)
    assert_includes text, 'privacy: "private"'
    assert_includes text, "[user_confirmed]"
    assert_includes text, "[inference]"
    saved = head
    replay, = run_capture
    assert_equal "already_committed", replay["outcome"]
    assert_equal saved, head
    changed = payload.merge("title" => "Changed content for same event")
    conflict, failed = run_capture(changed)
    refute failed.success?
    assert_equal "event_conflict", conflict["error"]
    assert_equal saved, head
  end

  def test_staged_and_untracked_user_edits_are_preserved_and_queue_blocks_auto
    enable
    before = head
    File.write(File.join(@root, "user-note.md"), "A user edit.\n")
    git("add", "user-note.md")
    File.write(File.join(@root, "untracked-note.md"), "Untracked work.\n")
    index = File.binread(File.join(@root, ".git", "index"))
    result, = run_capture
    assert_equal "queued", result["outcome"]
    assert_equal "dirty_context", result["reason"]
    assert_equal before, head
    assert_equal index, File.binread(File.join(@root, ".git", "index"))
    assert_empty notes
    assert_equal "dirty_context", cli("list")["items"].first["reason"]
  end

  def test_changed_authorization_document_disables_auto_until_explicit_reapproval
    enable
    File.open(File.join(@root, "AGENTS.md"), "a") { |file| file.puts "A changed rule." }
    git("add", "AGENTS.md")
    git("commit", "-m", "Change fixture policy")
    before = head
    result, = run_capture
    assert_equal "queued", result["outcome"]
    assert_equal "authorization_document_changed", result["reason"]
    assert_equal before, head
    assert_empty notes
  end

  def test_secret_duplicate_unknown_and_control_fields_do_not_enter_queue
    secret = "ghp_" + "A" * 30
    cases = [
      payload.merge("unknown" => "field"), payload.merge("title" => "bad\nheading"),
      payload.merge("date" => "2026-02-30"), payload.merge("version" => 1.0),
      payload.merge("facts" => [{ "text" => secret, "evidence" => "artifact", "source" => "fixture" }]),
      JSON.generate(payload).sub('"version":1', '"version":1,"version":1'),
      payload.merge("facts" => [{ "text" => "A" * 33_000, "evidence" => "inference", "source" => "fixture" }])
    ]
    cases.each do |data|
      result, status, output = run_capture(data)
      refute status.success?
      assert_equal false, result["ok"]
      refute output.include?(secret)
      refute File.exist?(@state)
      assert_equal @original, head
    end
  end

  def test_queue_and_journal_symlinks_never_escape
    review, = run_capture
    event_dir = Dir.glob(File.join(@state, "*", "*", "receipt.json")).first.then { |path| File.dirname(path) }
    outside = File.join(@tmp, "outside")
    FileUtils.mkdir_p(outside)
    FileUtils.rm_r(event_dir)
    File.symlink(outside, event_dir)
    blocked, status = run_capture
    refute status.success?
    assert_equal "symlink_path", blocked["error"]
    assert_empty Dir.children(outside)
    File.unlink(event_dir)
    enable
    File.symlink(outside, File.join(@root, "journal"))
    git("add", "journal")
    git("commit", "-m", "Unsafe fixture link")
    result, status = run_capture(payload("other-event"))
    refute status.success?
    assert_equal "symlink_path", result["error"]
    assert_empty Dir.children(outside)
    assert_equal "queued", review["outcome"]
  end

  def test_ignored_transcripts_are_unread_and_unknown_links_queue_without_append
    enable
    FileUtils.mkdir_p(File.join(@root, ".codex"))
    File.binwrite(File.join(@root, ".codex", "auth.json"), "\xFF\x00".b)
    FileUtils.mkdir_p(File.join(@root, "sources", "session-exports"))
    File.binwrite(File.join(@root, "sources", "session-exports", "raw.jsonl"), "\xFF\x00".b)
    hook = <<~'CODE'
      class << File
        alias_method :capture_original_open, :open
        def open(path, *args, &block)
          raise "forbidden ignored file read" if path.to_s.include?("/.codex/") || path.to_s.include?("/sources/")
          capture_original_open(path, *args, &block)
        end
      end
      exit MyContextCapture.run(ARGV)
    CODE
    result, = run_capture(ruby_hook: hook)
    assert_equal "committed", result["outcome"]
    unknown, = run_capture(payload("unknown-link").merge("links" => ["project.missing"]))
    assert_equal "queued", unknown["outcome"]
    assert_equal "unknown_or_excluded_links", unknown["reason"]
    assert_equal 1, notes.length
  end

  def test_two_concurrent_captures_of_same_event_commit_once
    enable
    before = head
    results = 2.times.map { Thread.new { run_capture.first } }.map(&:value)
    assert_equal ["already_committed", "committed"], results.map { |result| result["outcome"] }.sort
    assert_equal "1", git("rev-list", "--count", "#{before}..HEAD")
    assert_equal 1, notes.length
    assert_equal "", git("status", "--porcelain")
  end

  def git_wrapper(body)
    bin = File.join(@tmp, "bin")
    FileUtils.mkdir_p(bin)
    real_git, = Open3.capture2("which", "git")
    wrapper = "#!#{RbConfig.ruby}\nrequire 'open3'\nREAL_GIT = #{real_git.strip.inspect}\n#{body}\nexec(REAL_GIT, *ARGV)\n"
    File.write(File.join(bin, "git"), wrapper)
    File.chmod(0o755, File.join(bin, "git"))
    { "PATH" => bin + File::PATH_SEPARATOR + ENV.fetch("PATH") }
  end

  def test_commit_failure_retains_queue_cleans_only_owned_file_and_retry_succeeds
    enable
    before = head
    env = git_wrapper('exit 1 if ARGV.include?("commit-tree")')
    result, = run_capture(env: env)
    assert_equal "queued", result["outcome"]
    assert_equal "git_failed", result["reason"]
    assert_equal before, head
    assert_empty notes
    assert_equal "", git("status", "--porcelain")
    refute File.exist?(File.join(@root, ".git", "index.lock"))
    retry_result, = run_capture
    assert_equal "committed", retry_result["outcome"]
    assert_equal 1, notes.length
  end

  def test_cas_failure_preserves_a_concurrent_commit_without_claiming_capture_saved
    enable
    before = head
    env = git_wrapper(<<~'CODE')
      if ARGV.include?("update-ref")
        i = ARGV.index("update-ref")
        branch, _new, old = ARGV[(i + 1)..]
        prefix = ARGV[0...i]
        output, _, status = Open3.capture3(REAL_GIT, *prefix, "commit-tree", "#{old}^{tree}", "-p", old, "-m", "Concurrent fixture commit")
        exit 8 unless status.success?
        _, _, moved = Open3.capture3(REAL_GIT, *prefix, "update-ref", branch, output.strip, old)
        exit 9 unless moved.success?
      end
    CODE
    result, = run_capture(env: env)
    assert_equal "pending", result["outcome"]
    assert_nil result["commit"]
    assert_equal "Concurrent fixture commit", git("log", "-1", "--format=%s")
    assert_equal "1", git("rev-list", "--count", "#{before}..HEAD")
    assert_equal "", git("diff", "--name-only", before, "HEAD")
    assert_equal 1, notes.length
    assert_equal "pending", cli("list")["items"].first["state"]
  end

  def test_index_publication_failure_is_explicit_and_verified_retry_repairs_only_own_entry
    enable
    git("update-index", "--assume-unchanged", "profile/summary.md")
    before_flags = git("ls-files", "-v", "profile/summary.md")
    hook = <<~'CODE'
      class << File
        alias_method :capture_original_rename, :rename
        def rename(from, to)
          raise Errno::EIO if to.end_with?("/.git/index")
          capture_original_rename(from, to)
        end
      end
      exit MyContextCapture.run(ARGV)
    CODE
    result, = run_capture(ruby_hook: hook)
    assert_equal false, result["ok"]
    assert_equal "needs_attention", result["outcome"]
    assert_equal "committed_index_needs_attention", result["reason"]
    committed = head
    assert_equal committed, result["commit"]
    assert_equal before_flags, git("ls-files", "-v", "profile/summary.md")
    retried, = run_capture
    assert_equal "already_committed", retried["outcome"]
    assert_equal true, retried["ok"]
    assert_equal committed, head
    assert_equal "", git("status", "--porcelain")
    assert_equal before_flags, git("ls-files", "-v", "profile/summary.md")
  end

  def test_unrelated_index_flags_and_detached_queue_reason_are_preserved
    enable
    git("update-index", "--assume-unchanged", "profile/summary.md")
    before = git("ls-files", "-v", "profile/summary.md")
    result, = run_capture
    assert_equal "committed", result["outcome"]
    assert_equal before, git("ls-files", "-v", "profile/summary.md")
    git("checkout", "--detach")
    detached, = run_capture(payload("detached-event"))
    assert_equal "queued", detached["outcome"]
    assert_equal "detached_head", detached["reason"]
    stored = cli("list")["items"].find { |item| item["event_id"] == "detached-event" }
    assert_equal "queued", stored["state"]
    assert_equal "detached_head", stored["reason"]
  end

  def test_index_recovery_does_not_overwrite_an_index_changed_after_interruption
    enable
    hook = <<~'CODE'
      class << File
        alias_method :capture_original_rename, :rename
        def rename(from, to)
          raise Errno::EIO if to.end_with?("/.git/index")
          capture_original_rename(from, to)
        end
      end
      exit MyContextCapture.run(ARGV)
    CODE
    interrupted, = run_capture(ruby_hook: hook)
    assert_equal "needs_attention", interrupted["outcome"]
    File.write(File.join(@root, "another-user-note.md"), "A later edit to preserve.\n")
    git("add", "another-user-note.md")
    index = File.binread(File.join(@root, ".git", "index"))
    committed = head
    retried, = run_capture
    assert_equal false, retried["ok"]
    assert_equal "needs_attention", retried["outcome"]
    assert_equal "committed_index_needs_attention", retried["reason"]
    assert_equal index, File.binread(File.join(@root, ".git", "index"))
    assert_equal committed, head
    assert_equal "needs_attention", cli("list")["items"].first["state"]
  end

  def test_corrupt_receipt_fails_closed_without_printing_private_payload
    run_capture
    receipt = Dir.glob(File.join(@state, "*", "*", "receipt.json")).first
    File.write(receipt, "null\n")
    result, status, output = run_capture
    refute status.success?
    assert_equal "queue_corrupt", result["error"]
    refute output.include?("comparison is incomplete")
    out, err, listed = Open3.capture3(ENVIRONMENT, RbConfig.ruby, CAPTURE, *command_args("list"))
    refute listed.success?
    assert_empty err
    assert_equal "queue_corrupt", JSON.parse(out)["error"]
    assert_equal @original, head
    assert_empty notes
  end
end
