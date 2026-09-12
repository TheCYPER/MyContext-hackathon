# frozen_string_literal: true

require "minitest/autorun"
require "tmpdir"
require "fileutils"
require "open3"
require "json"
require "psych"

class RetrievalTest < Minitest::Test
  SOURCE = File.expand_path("..", __dir__)
  SEARCH = File.join(SOURCE, "scripts", "search-context.sh")

  def setup
    @tmp = Dir.mktmpdir("mycontext-retrieval-test-")
    @root = File.join(@tmp, "context with spaces")
    FileUtils.mkdir_p(@root)
    @counter = 0
  end

  def teardown
    FileUtils.remove_entry(@tmp)
  end

  def document(path, body: "Evidence recorded for a fictional fixture.\n", root: @root, **overrides)
    @counter += 1
    data = {
      "id" => "project.fixture-#{@counter}", "type" => "project", "title" => "Fixture #{@counter}",
      "privacy" => "private", "updated" => "2026-01-01T00:00:00Z", "sources" => ["user:2026-01-01"],
      "aliases" => [], "tags" => [], "links" => [], "status" => "active"
    }.merge(overrides.transform_keys(&:to_s))
    target = File.join(root, path)
    FileUtils.mkdir_p(File.dirname(target))
    File.write(target, Psych.dump(data) + "---\n" + body)
    target
  end

  def search(*args, root: @root, env: {})
    command = ["bash", SEARCH]
    command += ["--root", root] if root
    Open3.capture3({ "MY_CONTEXT_ROOT" => nil, "MYCONTEXT_ROOT" => nil }.merge(env), *command, *args)
  end

  def result(*args, **options)
    out, err, status = search("--json", *args, **options)
    assert status.success?, err
    JSON.parse(out)
  end

  def paths(*args, **options)
    result(*args, **options).fetch("results").map { |entry| entry.fetch("path") }
  end

  def test_exact_id_outranks_many_alphabetically_earlier_body_mentions
    7.times { |i| document("projects/aaa-#{i}.md", body: "Mentions project.target.\n") }
    document("projects/zzz-target.md", id: "project.target", title: "Target")
    response = result("project.target")
    assert_equal "projects/zzz-target.md", response["results"].first["path"]
    assert_equal "exact id", response["results"].first["match_reason"]
    assert_equal 5, response["results"].length
    assert_equal 8, response["total_matches"]
  end

  def test_title_and_alias_precede_body_and_are_case_insensitive
    document("projects/a-body.md", body: "Solar Atlas in a longer sentence.\n")
    document("projects/z-alias.md", aliases: ["Solar Atlas"])
    document("projects/y-title.md", title: "Solar Atlas")
    found = paths("sOlAr aTlAs")
    assert_equal ["projects/y-title.md", "projects/z-alias.md", "projects/a-body.md"], found
  end

  def test_all_terms_required_even_when_split_across_metadata_and_body
    document("projects/complete.md", title: "Coral", tags: ["robotics"], body: "A rehearsal decision.\n")
    document("projects/partial.md", title: "Coral", body: "A rehearsal decision.\n")
    response = result("CORAL robotics rehearsal")
    assert_equal ["projects/complete.md"], response["results"].map { |entry| entry["path"] }
    assert_equal ["title", "tags", "body"], response["results"].first["matched_fields"]
    assert_equal ["user:2026-01-01"], response["results"].first["sources"]
    assert_equal "private", response["results"].first["privacy"]
    assert_match(/rehearsal/, response["results"].first["snippet"])
  end

  def test_chinese_phrases_and_punctuation_are_literal_terms
    document("projects/music.md", aliases: ["实时伴奏"], body: "Literal a.b [draft] C++ terms.\n")
    document("projects/other.md", aliases: ["实时"], body: "Literal axb draft C terms.\n")
    assert_equal ["projects/music.md"], paths("实时伴奏")
    assert_equal ["projects/music.md"], paths("a.b [draft] C++")
    assert_empty paths(".*")
  end

  def test_snippet_prefers_matching_prose_to_heading_or_unrelated_intro
    document("projects/needle.md", title: "Needle", body: "# Needle\n\nAn unrelated introduction.\n\nThe Needle decision was to keep files local.\n")
    assert_equal "The Needle decision was to keep files local.", result("Needle")["results"].first["snippet"]
  end

  def test_current_canonical_record_precedes_equally_relevant_recent_journal
    document("journal/2026/event.md", type: "journal", title: "Lunar", updated: "2026-09-01T00:00:00Z")
    document("projects/current.md", title: "Lunar", updated: "2026-01-01T00:00:00Z")
    document("projects/archive.md", title: "Lunar", status: "archived", updated: "2026-10-01T00:00:00Z")
    assert_equal ["projects/current.md", "journal/2026/event.md", "projects/archive.md"], paths("--include-archived", "Lunar")
  end

  def test_quoted_restricted_privacy_is_excluded_and_body_is_not_read
    document("projects/public.md", title: "Needle", privacy: "public")
    restricted = document("projects/restricted.md", title: "Needle", privacy: "restricted", body: "\xFF".b)
    bytes = File.binread(restricted).sub("privacy: restricted", 'privacy: "restricted"')
    File.binwrite(restricted, bytes)
    response = result("Needle")
    assert_equal ["projects/public.md"], response["results"].map { |entry| entry["path"] }
    assert_equal 0, response["excluded_invalid"], "A filtered body must not be read even to diagnose encoding"
    assert_equal 1, result("--include-restricted", "Needle")["excluded_invalid"]
  end

  def test_draft_type_status_and_directory_each_need_explicit_opt_in
    document("projects/active.md", title: "Needle")
    document("projects/typed.md", title: "Needle", type: "draft", status: "draft")
    document("ideas/research/potential.md", title: "Needle", type: "idea", status: "draft")
    document("people/fictional/drafts/message.md", title: "Needle")
    assert_equal ["projects/active.md"], paths("Needle")
    assert_equal 4, paths("--include-drafts", "Needle").length
  end

  def test_sources_restricted_and_archived_filters_are_independent
    document("projects/active.md", title: "Needle")
    document("sources/session-exports/test/export.md", title: "Needle", type: "session_export", privacy: "restricted", status: "archived")
    assert_equal ["projects/active.md"], paths("--include-sources", "Needle")
    assert_equal ["projects/active.md"], paths("--include-sources", "--include-restricted", "Needle")
    assert_equal 2, paths("--include-sources", "--include-restricted", "--include-archived", "Needle").length
    out, err, status = search("Needle", "sources")
    assert_equal 2, status.exitstatus
    assert_empty out
    assert_match(/--include-sources/, err)
  end

  def test_invalid_envelopes_fail_closed_including_duplicate_yaml_keys
    valid = document("projects/valid.md", title: "Needle")
    template = File.read(valid)
    mutations = [
      template.sub(/^privacy:.*\n/, ""),
      template.sub(/^privacy:.*\n/, "privacy: public\nprivacy: restricted\n"),
      template.sub(/^privacy:.*\n/, "privacy: [public]\n"),
      template.sub(/^privacy:.*\n/, "privacy: unknown\n"),
      template.sub(/^title:.*\n/, "title: [unclosed\n"),
      template.sub(/^title:.*\n/, "title: !ruby/object:Object {}\n"),
      template.sub(/^title:.*\n/, "title: &name Needle\naliases: [*name]\n"),
      template.sub(/^status:.*\n/, ""),
      template.sub(/^updated:.*\n/, "updated: yesterday\n"),
      "Needle with no frontmatter\n"
    ]
    mutations.each_with_index { |text, i| File.write(File.join(@root, "projects", "invalid-#{i}.md"), text) }
    response = result("--include-restricted", "--include-drafts", "--include-archived", "Needle")
    assert_equal ["projects/valid.md"], response["results"].map { |entry| entry["path"] }
    assert_equal mutations.length, response["excluded_invalid"]
  end

  def test_scope_traversal_absolute_paths_and_missing_scopes_fail
    document("projects/inside.md", title: "Needle")
    ["projects/../../outside", @root, "projects/../projects", "projects//inside.md", "projects/missing"].each do |scope|
      out, err, status = search("Needle", scope)
      assert_equal 2, status.exitstatus, scope
      assert_empty out
      refute_empty err
    end
    assert_equal ["projects/inside.md"], paths("Needle", "projects/inside.md")
  end

  def test_symlinked_files_directories_and_root_scopes_do_not_escape
    outside = File.join(@tmp, "outside")
    escaped = document("projects/secret.md", root: outside, title: "OutsideMarker")
    document("projects/inside.md", title: "InsideMarker")
    File.symlink(escaped, File.join(@root, "projects", "linked.md"))
    File.symlink(File.join(outside, "projects"), File.join(@root, "projects", "linked-directory"))
    File.symlink(File.join(outside, "projects"), File.join(@root, "people"))
    assert_empty paths("OutsideMarker")
    ["projects/linked.md", "projects/linked-directory", "projects/linked-directory/secret.md", "people"].each do |scope|
      _, err, status = search("OutsideMarker", scope)
      assert_equal 2, status.exitstatus
      assert_match(/symbolic link/, err)
    end
  end

  def test_environment_precedence_and_invalid_explicit_root_do_not_fall_back
    preferred = File.join(@tmp, "preferred")
    alias_root = File.join(@tmp, "alias")
    document("projects/preferred.md", root: preferred, title: "Needle")
    document("projects/alias.md", root: alias_root, title: "Needle")
    document("projects/explicit.md", title: "Needle")
    env = { "MY_CONTEXT_ROOT" => preferred, "MYCONTEXT_ROOT" => alias_root }
    assert_equal ["projects/explicit.md"], paths("Needle", env: env)
    assert_equal ["projects/preferred.md"], paths("Needle", root: nil, env: env)
    assert_equal ["projects/alias.md"], paths("Needle", root: nil, env: env.merge("MY_CONTEXT_ROOT" => ""))
    _, _, status = search("Needle", root: nil, env: env.merge("MY_CONTEXT_ROOT" => File.join(@tmp, "missing")))
    assert_equal 2, status.exitstatus
  end

  def test_default_context_is_local_demo_under_software_root
    app = File.join(@tmp, "application")
    FileUtils.mkdir_p(File.join(app, "scripts"))
    %w[search-context.sh search_context.rb].each { |file| FileUtils.cp(File.join(SOURCE, "scripts", file), File.join(app, "scripts", file)) }
    document("projects/demo.md", root: File.join(app, ".local", "demo"), title: "Needle")
    out, err, status = Open3.capture3({ "MY_CONTEXT_ROOT" => nil, "MYCONTEXT_ROOT" => nil }, "bash", File.join(app, "scripts", "search-context.sh"), "Needle", chdir: @root)
    assert status.success?, err
    assert_equal "projects/demo.md\n", out
  end

  def test_limit_path_output_determinism_no_match_and_input_errors
    6.times { |i| document("projects/entry-#{i}.md", title: "Needle") }
    out, err, status = search("--limit", "2", "Needle")
    assert status.success?, err
    assert_equal "projects/entry-0.md\nprojects/entry-1.md\n", out
    assert_equal out, search("--limit", "2", "Needle").first
    none, none_err, none_status = search("unknown-token")
    assert none_status.success?, none_err
    assert_empty none
    [["--limit", "0", "Needle"], ["--limit", "101", "Needle"], ["--limit", "no", "Needle"], ["   "], ["--unknown"], ["Needle", "projects", "extra"]].each do |arguments|
      _, error, failed = search(*arguments)
      assert_equal 2, failed.exitstatus
      refute_empty error
    end
    _, _, failed = search("Needle", root: "relative")
    assert_equal 2, failed.exitstatus
  end
end
