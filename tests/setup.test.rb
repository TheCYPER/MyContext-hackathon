#!/usr/bin/env ruby
# frozen_string_literal: true

require "fileutils"
require "json"
require "minitest/autorun"
require "open3"
require "tmpdir"

class ContextSetupTest < Minitest::Test
  SOURCE = File.expand_path("..", __dir__)

  def setup
    @temporary = Dir.mktmpdir("mycontext-setup-test-")
    @source = File.join(@temporary, "software")
    FileUtils.mkdir_p(File.join(@source, "scripts"))
    %w[templates examples meta].each { |entry| FileUtils.cp_r(File.join(SOURCE, entry), @source) }
    %w[setup.sh setup.rb].each { |entry| FileUtils.cp(File.join(SOURCE, "scripts", entry), File.join(@source, "scripts")) }
    git(@source, "init", "--initial-branch=main")
    File.write(File.join(@source, "source-only.txt"), "must not enter the context\n")
    git(@source, "add", "source-only.txt")
    git(@source, "commit", "-m", "Source history must remain separate")
  end

  def teardown
    FileUtils.remove_entry(@temporary) if @temporary && File.exist?(@temporary)
  end

  def git(root, *arguments)
    output, error, status = Open3.capture3({ "GIT_CONFIG_GLOBAL" => File::NULL, "GIT_CONFIG_NOSYSTEM" => "1" },
      "git", "-C", root, "-c", "user.name=Setup Test", "-c", "user.email=test@example.invalid",
      "-c", "commit.gpgsign=false", "-c", "core.hooksPath=#{File::NULL}", *arguments)
    assert status.success?, error
    output.strip
  end

  def run_setup(*arguments)
    Open3.capture3("bash", File.join(@source, "scripts", "setup.sh"), *arguments)
  end

  def assert_setup(*arguments)
    output, error, status = run_setup(*arguments)
    assert status.success?, "#{output}\n#{error}"
    output
  end

  def assert_refused(*arguments)
    output, error, status = run_setup(*arguments)
    refute status.success?, output
    assert_match(/setup:/, error)
    error
  end

  def test_demo_has_fictional_records_and_independent_history
    assert_setup("demo")
    root = File.join(@source, ".local", "demo")
    assert_equal "1", git(root, "rev-list", "--count", "HEAD")
    refute_equal git(@source, "rev-parse", "HEAD"), git(root, "rev-parse", "HEAD")
    assert_equal "", git(root, "remote")
    assert_equal "", git(root, "status", "--porcelain")
    assert_equal "MyContext Setup <setup@example.invalid>", git(root, "log", "-1", "--format=%an <%ae>")
    refute File.exist?(File.join(root, "source-only.txt"))
    refute File.exist?(File.join(root, ".git", "objects", "info", "alternates"))
    records = Dir.glob(File.join(root, "{profile,domains,projects,ideas,experience,people,journal}", "**", "*.md"))
    expected_records = Dir.glob(File.join(@source, "examples", "demo", "{profile,domains,projects,ideas,experience,people,journal}", "**", "*.md"))
    assert_equal expected_records.length, records.length
    assert_operator records.length, :>, 0
    records.each { |path| assert_includes File.read(path), 'sources: ["demo:fictional"]' }
    assert_equal "AGENTS.md", File.readlink(File.join(root, "CLAUDE.md"))
  end

  def test_demo_rerun_preserves_clean_context_and_refuses_dirty_context
    assert_setup("demo")
    root = File.join(@source, ".local", "demo")
    before = git(root, "rev-parse", "HEAD")
    assert_match(/already exists/, assert_setup("demo"))
    assert_equal before, git(root, "rev-parse", "HEAD")
    profile = File.join(root, "profile", "summary.md")
    File.open(profile, "a") { |file| file.puts "A local change that setup must preserve." }
    assert_match(/local changes/, assert_refused("demo"))
    assert_includes File.read(profile), "A local change that setup must preserve."
    assert_equal before, git(root, "rev-parse", "HEAD")
  end

  def test_personal_context_is_blank_local_and_has_all_folders
    root = File.join(@temporary, "personal notes")
    assert_setup("personal", root)
    assert_equal "", git(root, "remote")
    assert_equal "1", git(root, "rev-list", "--count", "HEAD")
    assert_equal "", git(root, "status", "--porcelain")
    assert_includes File.read(File.join(root, "profile", "summary.md")), "no personal facts"
    assert_equal 0, File.stat(root).mode & 0o077, "personal context must not grant group or other access"
    refute_includes File.read(File.join(root, "profile", "summary.md")), "Demo Builder"
    %w[profile domains projects ideas/research ideas/projects experience people journal sources meta].each do |folder|
      assert File.directory?(File.join(root, folder)), folder
    end
    assert File.file?(File.join(root, "meta", "schema.md"))
    assert File.file?(File.join(root, "meta", "write-policy.md"))
    assert_match(/destination already exists/, assert_refused("personal", root))
    assert_equal "1", git(root, "rev-list", "--count", "HEAD")
  end

  def test_changed_demo_seed_preserves_existing_committed_notes
    assert_setup("demo")
    root = File.join(@source, ".local", "demo")
    note = File.join(root, "my-note.md")
    File.write(note, "A local note to keep.\n")
    git(root, "add", "my-note.md")
    git(root, "commit", "-m", "Keep a local note")
    before = git(root, "rev-parse", "HEAD")
    seed = File.join(@source, "examples", "demo", "profile", "summary.md")
    File.open(seed, "a") { |file| file.puts "An updated fictional academic scenario." }
    assert_match(/seed is outdated/, assert_refused("demo"))
    assert_equal before, git(root, "rev-parse", "HEAD")
    assert_equal "A local note to keep.\n", File.read(note)
  end

  def test_legacy_demo_requires_an_explicit_preserved_backup
    assert_setup("demo")
    root = File.join(@source, ".local", "demo")
    marker = File.join(root, ".mycontext-setup.json")
    File.write(marker, JSON.generate({ "format" => 1, "mode" => "demo" }) + "\n")
    git(root, "add", ".mycontext-setup.json")
    git(root, "commit", "-m", "Legacy setup marker")
    before = git(root, "rev-parse", "HEAD")
    assert_match(/seed is outdated/, assert_refused("demo"))
    assert_equal before, git(root, "rev-parse", "HEAD")
  end

  def test_unsafe_and_ambiguous_destinations_are_refused
    assert_refused("personal", "relative-context")
    inside_source = File.join(@source, "private-data")
    assert_match(/outside .local/, assert_refused("personal", inside_source))
    refute File.exist?(inside_source)
    assert_match(/container itself/, assert_refused("personal", File.join(@source, ".local")))
    other_repo = File.join(@temporary, "existing-repo")
    FileUtils.mkdir_p(other_repo)
    git(other_repo, "init", "--initial-branch=main")
    assert_match(/nested inside/, assert_refused("personal", File.join(other_repo, "private-data")))
    assert_refused("demo", "unexpected")
    assert_refused("personal")
  end

  def test_local_personal_destination_is_allowed_and_symlink_escape_is_refused
    assert_setup("personal", File.join(@source, ".local", "personal"))
    escaped_source = File.join(@temporary, "escaped")
    FileUtils.mkdir_p(escaped_source)
    FileUtils.rm_rf(File.join(@source, ".local"))
    File.symlink(escaped_source, File.join(@source, ".local"))
    assert_match(/symbolic link/, assert_refused("demo"))
    refute File.exist?(File.join(escaped_source, "demo"))
  end

  def test_existing_unmarked_demo_is_not_modified
    root = File.join(@source, ".local", "demo")
    FileUtils.mkdir_p(root)
    path = File.join(root, "keep.txt")
    File.write(path, "existing data\n")
    assert_match(/without a matching setup marker/, assert_refused("demo"))
    assert_equal "existing data\n", File.read(path)
    refute File.exist?(File.join(root, ".git"))
  end

  def test_old_prerequisites_fail_before_creating_data
    %w[git node].each do |tool|
      fake_bin = File.join(@temporary, "old-#{tool}-bin")
      FileUtils.mkdir_p(fake_bin)
      reported = tool == "git" ? "git version 2.27.0" : "v18.20.0"
      executable = File.join(fake_bin, tool)
      File.write(executable, "#!/bin/sh\nprintf '%s\\n' '#{reported}'\n")
      File.chmod(0o755, executable)
      destination = File.join(@temporary, "blocked-#{tool}")
      output, error, status = Open3.capture3({ "PATH" => fake_bin + File::PATH_SEPARATOR + ENV.fetch("PATH") },
        "bash", File.join(@source, "scripts", "setup.sh"), "personal", destination)
      refute status.success?, output
      assert_match(/is required/, error)
      refute File.exist?(destination), "failed prerequisites must not create context data"
    end
  end
end
