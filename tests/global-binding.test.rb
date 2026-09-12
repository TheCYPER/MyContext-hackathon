# frozen_string_literal: true
require "minitest/autorun"
require "tmpdir"
require "fileutils"
require "stringio"
require_relative "../scripts/context_binding"
require_relative "../scripts/install-global-skill"

class GlobalBindingTest < Minitest::Test
  ENV_KEYS = %w[MY_CONTEXT_ROOT MYCONTEXT_ROOT MY_CONTEXT_CONFIG XDG_CONFIG_HOME].freeze

  def setup
    @original_env = ENV_KEYS.to_h { |key| [key, ENV[key]] }
    ENV_KEYS.each { |key| ENV.delete(key) }
    @tmp = File.realpath(Dir.mktmpdir("mycontext-global-test-"))
    @context = make_context("my context")
    @other = make_context("another context")
    @config = File.join(@tmp, "settings", "config.json")
    @state = File.join(@tmp, "state")
    @skills = [File.join(@tmp, "client-a", "skills"), File.join(@tmp, "client-b", "skills")]
    @source = MyContextBinding.app_root
    @skill_source = File.join(@source, "skills", "my-context")
  end

  def teardown
    ENV_KEYS.each { |key| @original_env[key].nil? ? ENV.delete(key) : ENV[key] = @original_env[key] }
    FileUtils.remove_entry(@tmp)
  end

  def make_context(name)
    root = File.join(@tmp, name)
    MyContextBinding::REQUIRED_FILES.each do |relative|
      path = File.join(root, relative)
      FileUtils.mkdir_p(File.dirname(path))
      File.write(path, "# Synthetic test context\n")
    end
    git(root, "-c", "init.templateDir=", "init", "--quiet")
    root
  end

  def git(root, *args)
    out, err, status = Open3.capture3(MyContextBinding::GIT_ENV, "git", "-C", root, *args)
    assert status.success?, out + err
    out.strip
  end

  def data_for(root = @context)
    { "version" => 1, "app_root" => @source, "context_root" => root,
      "git_dir" => File.realpath(git(root, "rev-parse", "--absolute-git-dir")), "state_dir" => @state }
  end

  def write_binding(data = data_for)
    FileUtils.mkdir_p(File.dirname(@config))
    File.write(@config, JSON.generate(data))
  end

  def resolve(**options)
    MyContextBinding.resolve(**{ config_path: @config, state_dir: @state }.merge(options))
  end

  def install(context: @context, config: @config, dirs: @skills)
    out = StringIO.new
    err = StringIO.new
    args = ["--context", context, "--config", config] + dirs.flat_map { |dir| ["--skills-dir", dir] }
    status = MyContextGlobalSkill.run(args, output: out, error: err)
    [status, out.string, err.string]
  end

  def assert_installed(dirs = @skills)
    dirs.each do |dir|
      assert_equal ["my-context"], Dir.children(dir)
      assert_equal @skill_source, File.realpath(File.join(dir, "my-context"))
    end
  end

  def test_explicit_root_from_any_cwd_does_not_read_or_create_binding_or_state
    nested = File.join(@other, "nested")
    FileUtils.mkdir_p(nested)
    before = git(@context, "status", "--porcelain")
    result = Dir.chdir(nested) { resolve(root: @context) }
    assert_equal @context, result[:context_root]
    assert_equal File.join(@context, ".git"), result[:git_dir]
    assert_equal @state, result[:state_dir]
    refute File.exist?(@config)
    refute File.exist?(@state)
    assert_equal before, git(@context, "status", "--porcelain")
  end

  def test_precedence_and_invalid_explicit_root_never_fall_back
    write_binding
    ENV["MY_CONTEXT_ROOT"] = @other
    ENV["MYCONTEXT_ROOT"] = @context
    assert_equal @context, resolve(root: @context)[:context_root]
    assert_equal @other, resolve[:context_root]
    ENV["MY_CONTEXT_ROOT"] = ""
    assert_equal @context, resolve[:context_root]
    ENV["MY_CONTEXT_ROOT"] = File.join(@tmp, "missing")
    assert_raises(MyContextBinding::Error) { resolve }
    assert_raises(MyContextBinding::Error) { resolve(root: "relative") }
    assert_raises(MyContextBinding::Error) { resolve(root: "") }
    assert_equal @context, resolve(root: @context)[:context_root]
  end

  def test_binding_is_used_independently_of_cwd_and_context_aliases_resolve
    write_binding
    assert_equal @context, Dir.chdir(@other) { resolve }[:context_root]
    alias_path = File.join(@tmp, "chosen alias")
    File.symlink(@context, alias_path)
    assert_equal @context, resolve(root: alias_path)[:context_root]
  end

  def test_no_binding_means_no_cwd_or_demo_fallback
    assert_raises(MyContextBinding::Error) { Dir.chdir(@context) { resolve } }
    assert_raises(MyContextBinding::Error) { Dir.chdir(@source) { resolve } }
    refute File.exist?(@config)
    refute File.exist?(@state)
  end

  def test_binding_format_application_and_identity_are_checked
    [data_for.merge("version" => 2), data_for.reject { |key, _| key == "git_dir" },
      data_for.merge("app_root" => @tmp), data_for.merge("git_dir" => File.join(@other, ".git"))].each do |data|
      write_binding(data)
      assert_raises(MyContextBinding::Error) { resolve }
    end
    File.write(@config, "{invalid")
    assert_raises(MyContextBinding::Error) { resolve }
    File.binwrite(@config, "{\"invalid\":\"" + 255.chr + "\"}")
    assert_raises(MyContextBinding::Error) { resolve }
    # An explicit root is independent of an unrelated saved binding.
    assert_equal @context, resolve(root: @context)[:context_root]
    File.unlink(@config)
    other_config = File.join(@tmp, "redirect.json")
    File.write(other_config, JSON.generate(data_for))
    File.symlink(other_config, @config)
    assert_raises(MyContextBinding::Error) { resolve }
  end

  def test_context_must_be_canonical_contained_and_its_own_git_root
    assert_raises(MyContextBinding::Error) { resolve(root: @source) }
    required = File.join(@context, "profile", "summary.md")
    File.unlink(required)
    assert_raises(MyContextBinding::Error) { resolve(root: @context) }
    File.symlink(File.join(@other, "profile", "summary.md"), required)
    assert_raises(MyContextBinding::Error) { resolve(root: @context) }
    child = File.join(@other, "nested-context")
    MyContextBinding::REQUIRED_FILES.each do |relative|
      target = File.join(child, relative)
      FileUtils.mkdir_p(File.dirname(target))
      File.write(target, "# Synthetic child\n")
    end
    assert_raises(MyContextBinding::Error) { resolve(root: child) }
  end

  def test_state_defaults_and_existing_ancestor_containment_without_writes
    result = MyContextBinding.resolve(root: @context, config_path: @config)
    assert_equal File.join(File.dirname(@config), "state"), result[:state_dir]
    refute File.exist?(File.dirname(@config))
    [@context, File.join(@context, "candidate-state"), @source, File.join(@source, ".local", "state"), "relative"].each do |state|
      assert_raises(MyContextBinding::Error) { resolve(root: @context, state_dir: state) }
    end
    redirected = File.join(@tmp, "redirected")
    File.symlink(@context, redirected)
    assert_raises(MyContextBinding::Error) { resolve(root: @context, state_dir: File.join(redirected, "new-state")) }
    plain_file = File.join(@tmp, "file")
    File.write(plain_file, "keep")
    assert_raises(MyContextBinding::Error) { resolve(root: @context, state_dir: plain_file) }
    assert_raises(MyContextBinding::Error) { resolve(root: @context, state_dir: File.join(plain_file, "state")) }
  end

  def test_config_selection_is_explicit_then_environment_then_xdg
    ENV["XDG_CONFIG_HOME"] = File.join(@tmp, "xdg")
    xdg = File.join(@tmp, "xdg", "mycontext", "config.json")
    assert_equal xdg, MyContextBinding.config_path
    ENV["MY_CONTEXT_CONFIG"] = @config
    assert_equal @config, MyContextBinding.config_path
    explicit = File.join(@tmp, "explicit.json")
    assert_equal explicit, MyContextBinding.config_path(explicit)
    ENV["MY_CONTEXT_CONFIG"] = "relative"
    assert_raises(MyContextBinding::Error) { MyContextBinding.config_path }
    assert_raises(MyContextBinding::Error) { resolve(root: @context, config_path: "relative") }
  end

  def test_installer_is_explicit_global_single_skill_private_and_idempotent
    before = git(@context, "status", "--porcelain")
    2.times do
      status, out, err = install
      assert_equal 0, status, out + err
      assert_installed
    end
    data = JSON.parse(File.read(@config))
    assert_equal data_for.merge("state_dir" => File.join(File.dirname(@config), "state")), data
    assert_equal 0o600, File.stat(@config).mode & 0o777
    inode = File.stat(@config).ino
    status, out, err = install
    assert_equal 0, status, out + err
    assert_equal inode, File.stat(@config).ino
    assert_equal before, git(@context, "status", "--porcelain")
    refute File.exist?(File.join(@context, ".agents"))
    refute File.exist?(data["state_dir"])
  end

  def test_existing_file_different_link_and_dangling_link_preflight_before_writes
    conflict = File.join(@skills.last, "my-context")
    FileUtils.mkdir_p(File.dirname(conflict))
    ["file", "different", "dangling"].each do |kind|
      case kind
      when "file" then File.write(conflict, "owner content")
      when "different" then File.symlink(@other, conflict)
      else File.symlink(File.join(@tmp, "missing"), conflict)
      end
      status, = install
      assert_equal 2, status
      refute File.exist?(File.dirname(@skills.first))
      refute File.exist?(@config)
      assert_equal "owner content", File.read(conflict) if kind == "file"
      File.unlink(conflict)
    end
  end

  def test_symlinked_global_parent_cannot_redirect_install
    outside = File.join(@tmp, "outside")
    FileUtils.mkdir_p(outside)
    File.symlink(outside, File.dirname(@skills.last))
    status, = install
    assert_equal 2, status
    assert_empty Dir.children(outside)
    refute File.exist?(File.dirname(@skills.first))
    refute File.exist?(@config)
  end

  def test_conflicting_binding_and_symlinked_config_parent_are_preserved
    write_binding(data_for(@other))
    original = File.binread(@config)
    status, = install
    assert_equal 2, status
    assert_equal original, File.binread(@config)
    refute File.exist?(File.dirname(@skills.first))
    FileUtils.remove_entry(File.dirname(@config))
    outside = File.join(@tmp, "outside")
    FileUtils.mkdir_p(outside)
    File.symlink(outside, File.dirname(@config))
    status, = install
    assert_equal 2, status
    assert_empty Dir.children(outside)
    refute File.exist?(File.dirname(@skills.first))
  end

  def with_file_failure(method, fail_on)
    original = File.method(method)
    calls = 0
    File.define_singleton_method(method) do |*args|
      calls += 1
      raise Errno::EACCES, "synthetic install failure" if calls == fail_on
      original.call(*args)
    end
    yield
  ensure
    File.define_singleton_method(method, original)
  end

  def test_partial_link_failure_rolls_back_only_new_artifacts
    existing = File.join(@tmp, "existing", "skills")
    FileUtils.mkdir_p(existing)
    File.symlink(@skill_source, File.join(existing, "my-context"))
    with_file_failure(:symlink, 2) do
      status, = install(dirs: [existing, *@skills])
      assert_equal 2, status
    end
    assert_equal @skill_source, File.realpath(File.join(existing, "my-context"))
    @skills.each { |directory| refute File.exist?(File.dirname(directory)) }
    refute File.exist?(@config)
  end

  def test_atomic_config_publication_failure_rolls_back_links_and_empty_parents
    with_file_failure(:link, 1) do
      status, = install
      assert_equal 2, status
    end
    @skills.each { |directory| refute File.exist?(File.dirname(directory)) }
    refute File.exist?(File.dirname(@config))
    refute File.exist?(@state)
  end


  def test_concurrent_binding_creation_is_preserved_and_install_rolls_back
    original = File.method(:symlink)
    config = @config
    File.define_singleton_method(:symlink) do |*args|
      result = original.call(*args)
      unless File.exist?(config)
        FileUtils.mkdir_p(File.dirname(config))
        File.write(config, "concurrent owner config")
      end
      result
    end
    status, = install
    assert_equal 2, status
    assert_equal "concurrent owner config", File.read(@config)
    @skills.each { |directory| refute File.exist?(File.join(directory, "my-context")) }
  ensure
    File.define_singleton_method(:symlink, original)
  end

  def test_concurrent_conflicting_link_is_never_mistaken_for_idempotent_install
    original = File.method(:symlink)
    conflict = File.join(@skills.last, "my-context")
    other = @other
    File.define_singleton_method(:symlink) do |*args|
      result = original.call(*args)
      unless File.symlink?(conflict)
        FileUtils.mkdir_p(File.dirname(conflict))
        original.call(other, conflict)
      end
      result
    end
    status, = install
    assert_equal 2, status
    assert_equal @other, File.realpath(conflict)
    refute File.exist?(File.join(@skills.first, "my-context"))
    refute File.exist?(@config)
  ensure
    File.define_singleton_method(:symlink, original)
  end

  def test_cli_returns_json_and_rejects_positional_or_missing_selection
    output = StringIO.new
    errors = StringIO.new
    status = MyContextBinding.run(["--root", @context, "--config", @config, "--state-dir", @state], output: output, error: errors)
    assert_equal 0, status, errors.string
    assert_equal @context, JSON.parse(output.string)["context_root"]
    status = MyContextGlobalSkill.run(["--config", @config, "--skills-dir", @skills.first], output: StringIO.new, error: StringIO.new)
    assert_equal 2, status
    refute File.exist?(@config)
    assert_equal 2, MyContextBinding.run(["extra"], output: StringIO.new, error: StringIO.new)
  end
end
