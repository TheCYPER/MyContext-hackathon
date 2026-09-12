# frozen_string_literal: true
require "minitest/autorun"
require "tmpdir"
require "fileutils"
require "open3"

class InstallSkillsTest < Minitest::Test
  SOURCE = File.expand_path("..", __dir__)
  def setup
    @tmp = Dir.mktmpdir("mycontext-skills-test-")
    @context = File.join(@tmp, "my context")
    out, err, status = Open3.capture3("bash", File.join(SOURCE, "scripts/setup.sh"), "personal", @context)
    assert status.success?, out + err
  end
  def teardown
    FileUtils.remove_entry(@tmp)
  end
  def install
    Open3.capture3("bash", File.join(SOURCE, "scripts/install-skills.sh"), @context)
  end
  def test_install_is_local_idempotent_and_ignored
    2.times do
      out, err, status = install
      assert status.success?, out + err
    end
    Dir.glob(File.join(SOURCE, "skills", "*", "SKILL.md")).each do |skill|
      %w[.agents .claude].each do |client|
        target = File.join(@context, client, "skills", File.basename(File.dirname(skill)))
        assert_equal File.dirname(skill), File.realpath(target)
      end
    end
    out, status = Open3.capture2("git", "-C", @context, "status", "--porcelain")
    assert status.success?
    assert_empty out
  end
  def test_conflict_preflight_preserves_existing_files_without_partial_install
    target = File.join(@context, ".claude", "skills", "outreach")
    FileUtils.mkdir_p(target)
    File.write(File.join(target, "keep.txt"), "owner content")
    _, _, status = install
    refute status.success?
    assert_equal "owner content", File.read(File.join(target, "keep.txt"))
    refute File.exist?(File.join(@context, ".agents"))
  end
  def test_symlink_parent_cannot_redirect_install
    outside = File.join(@tmp, "outside")
    FileUtils.mkdir_p(outside)
    File.symlink(outside, File.join(@context, ".agents"))
    _, _, status = install
    refute status.success?
    assert_empty Dir.children(outside)
    refute File.exist?(File.join(@context, ".claude"))
  end
end
