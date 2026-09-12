# frozen_string_literal: true
require "minitest/autorun"
require "tmpdir"
require "fileutils"
require "open3"

class PublicBoundaryTest < Minitest::Test
  CHECK = File.expand_path("../scripts/public-check.rb", __dir__)
  def setup
    @root = Dir.mktmpdir("mycontext-public-test-")
    File.write(File.join(@root, "README.md"), "# Fictional fixture\n")
  end
  def teardown
    FileUtils.remove_entry(@root)
  end
  def write(path, body)
    target = File.join(@root, path)
    FileUtils.mkdir_p(File.dirname(target))
    File.write(target, body)
  end
  def accepted?
    _, _, status = Open3.capture3("ruby", CHECK, @root)
    status.success?
  end
  def test_code_and_expected_claude_link_are_accepted
    write("AGENTS.md", "# Software instructions\n")
    File.symlink("AGENTS.md", File.join(@root, "CLAUDE.md"))
    assert accepted?
  end
  def test_personal_roots_and_forced_local_data_are_rejected
    ["profile/summary.md", ".local/demo/profile/summary.md"].each do |path|
      write(path, "owner data")
      refute accepted?, path
      FileUtils.rm_rf(File.join(@root, path.split("/").first))
    end
  end
  def test_link_to_external_data_is_rejected
    FileUtils.mkdir_p(File.join(@root, "docs"))
    File.symlink("../../outside", File.join(@root, "docs", "private.md"))
    refute accepted?
  end
  def test_real_source_locators_cannot_enter_distributed_context
    %w[demo:fictional user:2026-01-01].each do |source|
      write("examples/demo/profile/summary.md", "---\nsources: [\"#{source}\"]\n---\n\nFixture\n")
      assert_equal source == "demo:fictional", accepted?
    end
  end
  def test_relation_sources_must_also_be_synthetic_in_distributed_context
    %w[demo:fictional user:2026-01-01].each do |source|
      write("examples/demo/projects/fixture.md", "---\nsources: [\"demo:fictional\"]\nrelations:\n  - sources: [\"#{source}\"]\n---\n\nFixture\n")
      assert_equal source == "demo:fictional", accepted?
    end
  end
  def test_binary_and_secret_file_extensions_require_explicit_review
    ["docs/notes.jsonl", "docs/key.pem", "docs/image.png"].each do |path|
      write(path, "binary\0fixture")
      refute accepted?, path
      File.delete(File.join(@root, path))
    end
  end
end
