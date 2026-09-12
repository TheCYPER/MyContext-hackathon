# frozen_string_literal: true
require "minitest/autorun"
require "tmpdir"
require "fileutils"
require "open3"
require "psych"

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
      write("examples/demo/profile/summary.md", "---\ndemo_kind: fictional\nsources: [\"#{source}\"]\n---\n\nFixture\n")
      assert_equal source == "demo:fictional", accepted?
    end
  end
  def public_reference(**changes)
    metadata = {
      "type" => "resource", "privacy" => "public", "status" => "active", "demo_kind" => "public_reference",
      "sources" => ["demo:public-reference", "web:https://library.example.invalid/books/fixture"]
    }.merge(changes.transform_keys(&:to_s))
    write("examples/demo/resources/books/fixture.md", Psych.dump(metadata) + "---\n\nPublic-source fixture.\n")
  end
  def test_public_references_need_separate_provenance_and_safe_public_sources
    public_reference
    assert accepted?
    public_reference(type: "person")
    assert accepted?
    [
      { privacy: "private" }, { status: "draft" }, { type: "profile" },
      { demo_kind: "fictional" }, { demo_kind: nil },
      { sources: ["demo:public-reference"] },
      { sources: ["demo:public-reference", "user:2026-09-12"] },
      { sources: ["demo:public-reference", "web:http://example.invalid"] },
      { sources: ["demo:public-reference", "web:https:///missing-host"] },
      { sources: ["demo:public-reference", "web:https://" + ["username", "password"].join(":") + "@example.invalid"] },
      { sources: ["demo:public-reference", "demo:fictional", "web:https://example.invalid"] },
      { sources: ["demo:public-reference", "demo:public-reference", "web:https://example.invalid"] },
      { sources: ["web:https://example.invalid"] }
    ].each do |changes|
      public_reference(**changes)
      refute accepted?, changes.inspect
    end
  end
  def test_undeclared_and_duplicate_demo_provenance_are_rejected
    write("examples/demo/profile/summary.md", "---\nsources: [\"demo:fictional\"]\n---\n\nFixture\n")
    refute accepted?
    public_reference
    target = File.join(@root, "examples/demo/resources/books/fixture.md")
    File.write(target, File.read(target).sub("privacy: public", "privacy: private\nprivacy: public"))
    refute accepted?
  end
  def test_binary_and_secret_file_extensions_require_explicit_review
    ["docs/notes.jsonl", "docs/key.pem", "docs/image.png"].each do |path|
      write(path, "binary\0fixture")
      refute accepted?, path
      File.delete(File.join(@root, path))
    end
  end
end
