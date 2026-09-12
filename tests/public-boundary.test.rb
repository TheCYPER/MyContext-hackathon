# frozen_string_literal: true
require "minitest/autorun"
require "tmpdir"
require "fileutils"
require "open3"
require "zlib"

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
  def png_chunk(type, content)
    [content.bytesize].pack("N") + type + content + [Zlib.crc32(type + content)].pack("N")
  end
  def png(width: 1, height: 1)
    "\x89PNG\r\n\x1a\n".b +
      png_chunk("IHDR", [width, height, 8, 6, 0, 0, 0].pack("NNCCCCC")) +
      png_chunk("IDAT", Zlib.deflate("\0\0\0\0\xff".b)) +
      png_chunk("IEND", "")
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
  def test_only_named_demo_screenshots_accept_png_binary
    %w[overview graph project].each do |name|
      write("docs/assets/screenshots/#{name}.png", png)
      assert accepted?, name
    end
    write("docs/assets/screenshots/unreviewed.png", png)
    refute accepted?
  end
  def test_reviewed_screenshot_still_requires_valid_png
    path = "docs/assets/screenshots/overview.png"
    ["not a PNG", png.byteslice(0, 30), png + "trailing data", png.sub("IDAT", "BAD!")].each do |bytes|
      write(path, bytes)
      refute accepted?
    end
    corrupted = png.dup
    corrupted.setbyte(29, corrupted.getbyte(29) ^ 1)
    write(path, corrupted)
    refute accepted?, "a damaged header must fail the checksum"
  end
  def test_reviewed_screenshot_has_size_and_dimension_limits
    path = "docs/assets/screenshots/overview.png"
    [png(width: 0), png(height: 4097), png + "\0" * (5 * 1024 * 1024)].each do |bytes|
      write(path, bytes)
      refute accepted?
    end
  end
  def test_static_svg_accepts_local_gradients_and_fragment_references
    write("docs/assets/concept.svg", '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ink"/><symbol id="box"/></defs><rect fill="url(#ink)"/><use href="#box"/></svg>')
    assert accepted?
  end
  def test_static_svg_rejects_active_content_and_external_references
    bodies = [
      '<script>alert(1)</script>',
      '<foreignObject/>',
      '<rect onload="alert(1)"/>',
      '<use href="https://example.invalid/image.svg#box"/>',
      '<image href="data:image/png;base64,fixture"/>',
      '<rect fill="url(https://example.invalid/paint.svg#ink)"/>',
      '<style>@import "https://example.invalid/style.css";</style>',
      '<use href="&#104;ttps://example.invalid/image.svg#box"/>',
      '<!DOCTYPE svg [<!ENTITY external SYSTEM "https://example.invalid/data">]>'
    ]
    bodies.each do |body|
      write("docs/assets/concept.svg", "<svg>#{body}</svg>")
      refute accepted?, body
    end
  end
end
