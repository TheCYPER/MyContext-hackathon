#!/usr/bin/env ruby
# frozen_string_literal: true

require "fileutils"
require "date"
require "json"
require "minitest/autorun"
require "open3"
require "psych"
require "time"
require "tmpdir"
require "uri"

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
    pattern = "{profile,domains,projects,ideas,experience,people,resources,journal}/**/*.md"
    records = Dir.glob(File.join(root, pattern))
    expected_records = Dir.glob(File.join(@source, "examples", "demo", pattern))
    assert_equal expected_records.length, records.length
    assert_operator records.length, :>, 0
    kinds = Hash.new(0)
    records.each do |path|
      content = File.read(path)
      assert content.start_with?("---\n"), path
      metadata = Psych.safe_load(content.split("\n---\n", 2).first.delete_prefix("---\n"),
        permitted_classes: [Date, Time], aliases: false)
      kind = metadata.fetch("demo_kind")
      kinds[kind] += 1
      case kind
      when "fictional"
        assert_equal ["demo:fictional"], metadata["sources"], path
      when "public_reference"
        assert_includes %w[person resource], metadata["type"], path
        assert_equal "public", metadata["privacy"], path
        assert_equal "active", metadata["status"], path
        sources = metadata.fetch("sources")
        assert_kind_of Array, sources, path
        assert_equal 1, sources.count("demo:public-reference"), path
        web_sources = sources.reject { |source| source == "demo:public-reference" }
        refute_empty web_sources, path
        web_sources.each do |source|
          assert_match(/\Aweb:https:\/\//, source, path)
          url = URI.parse(source.delete_prefix("web:"))
          assert_kind_of URI::HTTPS, url, path
          refute_nil url.host, path
          refute_empty url.host, path
          assert_nil url.userinfo, path
        end
        assert_match(/\A\d{4}-\d{2}-\d{2}\z/, metadata.fetch("accessed").to_s, path)
      else
        flunk "unexpected demo provenance #{kind.inspect}: #{path}"
      end
    end
    assert_operator kinds["fictional"], :>, 0
    assert_operator kinds["public_reference"], :>, 0
    assert_equal "AGENTS.md", File.readlink(File.join(root, "CLAUDE.md"))
    marker = JSON.parse(File.read(File.join(root, ".mycontext-setup.json")))
    assert_equal "demo", marker["mode"]
    assert_match(/\A[0-9a-f]{64}\z/, marker["seed_sha256"])
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
    assert_includes File.read(File.join(root, "profile", "summary.md")), "No personal facts"
    assert_equal 0, File.stat(root).mode & 0o077, "personal context must not grant group or other access"
    refute_includes File.read(File.join(root, "profile", "summary.md")), "Demo Builder"
    %w[profile domains projects ideas/research ideas/projects experience people resources journal sources meta].each do |folder|
      assert File.directory?(File.join(root, folder)), folder
    end
    assert File.file?(File.join(root, "meta", "schema.md"))
    assert File.file?(File.join(root, "meta", "write-policy.md"))
    assert_blank_context(root)
    assert_match(/destination already exists/, assert_refused("personal", root))
    assert_equal "1", git(root, "rev-list", "--count", "HEAD")
  end

  def assert_blank_context(root)
    pattern = "{profile,domains,projects,ideas,experience,people,resources,journal}/**/*.md"
    records = Dir.glob(File.join(root, pattern)).select { |path| File.read(path).start_with?("---\n") }
    assert_empty records, "blank setup must not create fake profile, preference, or goal records"
    refute File.exist?(File.join(root, "profile", "goals.md"))
    refute File.exist?(File.join(root, "profile", "preferences.md"))
    output, error, status = Open3.capture3("ruby", File.join(SOURCE, "dashboard", "projector.rb"), root)
    assert status.success?, "#{output}\n#{error}"
    projection = JSON.parse(output)
    assert_equal 0, projection.dig("counts", "total")
    assert_empty projection.fetch("entities")
    assert_empty projection.fetch("graph").fetch("nodes")
    assert_empty projection.fetch("graph").fetch("edges")
  end

  def test_empty_mode_has_zero_records_and_an_independent_local_history
    output = assert_setup("empty")
    assert_match(/zero records/, output)
    root = File.join(@source, ".local", "empty")
    assert_equal "1", git(root, "rev-list", "--count", "HEAD")
    assert_equal "", git(root, "remote")
    assert_equal "", git(root, "status", "--porcelain")
    assert_equal "empty", JSON.parse(File.read(File.join(root, ".mycontext-setup.json")))["mode"]
    assert_blank_context(root)
    before = git(root, "rev-parse", "HEAD")
    assert_match(/already exists/, assert_setup("empty"))
    assert_equal before, git(root, "rev-parse", "HEAD")
    refute File.exist?(File.join(@source, ".local", "demo"))
  end

  def test_stale_seed_refuses_to_silently_keep_old_demo_or_overwrite_committed_notes
    assert_setup("demo")
    root = File.join(@source, ".local", "demo")
    local_note = File.join(root, "my-notes.md")
    File.write(local_note, "A committed note setup must preserve.\n")
    git(root, "add", "my-notes.md")
    git(root, "commit", "-m", "Preserve a local note")
    before = git(root, "rev-parse", "HEAD")
    profile = File.join(@source, "examples", "demo", "profile", "summary.md")
    File.open(profile, "a") { |file| file.puts "The distributed demo has a new story." }
    assert_match(/seed is out of date/, assert_refused("demo"))
    assert_equal before, git(root, "rev-parse", "HEAD")
    assert_equal "A committed note setup must preserve.\n", File.read(local_note)
    refute_includes File.read(File.join(root, "profile", "summary.md")), "The distributed demo has a new story."
  end

  def test_legacy_demo_requires_preserving_old_folder_before_upgrade
    assert_setup("demo")
    root = File.join(@source, ".local", "demo")
    marker_path = File.join(root, ".mycontext-setup.json")
    File.write(marker_path, JSON.generate({ "format" => 1, "mode" => "demo" }) + "\n")
    git(root, "add", ".mycontext-setup.json")
    git(root, "commit", "-m", "Use a legacy setup marker")
    before = git(root, "rev-parse", "HEAD")
    assert_match(/no version fingerprint/, assert_refused("demo"))
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
    assert_refused("empty", "unexpected")
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
    assert_match(/symbolic link/, assert_refused("empty"))
    refute File.exist?(File.join(escaped_source, "empty"))
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
