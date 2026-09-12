import type { DashboardSnapshot, RepoStatus } from "../types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { SectionHeading } from "./section-heading";

const yesNo = (value: unknown) => (value === true ? "yes" : "no");
const short = (value?: string) => (value ? value.slice(0, 8) : "unavailable");

export function SystemView({
  snapshot,
  repo,
}: {
  snapshot: DashboardSnapshot;
  repo: RepoStatus | null;
}) {
  const groups = [
    {
      title: "Canonical source",
      rows: [
        ["Revision", short(repo?.revision || snapshot.revision)],
        [
          "Branch",
          repo ? repo.branch || "detached HEAD" : "status unavailable",
        ],
        [
          "Projection",
          String(
            repo?.canonicalSource ||
              snapshot.boundaries.canonicalSource ||
              "git-head",
          ),
        ],
        [
          "Working tree",
          repo
            ? repo.dirty
              ? "local changes present; not projected"
              : "clean"
            : "status unavailable",
        ],
      ],
    },
    {
      title: "Knowledge shape",
      rows: [
        ["Visible records", snapshot.counts.total],
        ["Projects", snapshot.counts.byType.project || 0],
        ["Work experiences", snapshot.counts.byType.experience || 0],
        ["Ideas", snapshot.counts.byType.idea || 0],
        ["People records", snapshot.counts.byType.person || 0],
        ["Drafts", snapshot.counts.byType.draft || 0],
      ],
    },
    {
      title: "Capabilities",
      rows: [
        ["Read", yesNo(snapshot.capabilities.readOnly)],
        ["Repository writes", yesNo(snapshot.capabilities.writes)],
        ["Email send", yesNo(snapshot.capabilities.emailSend)],
        ["Operation introspection", yesNo(snapshot.capabilities.operations)],
      ],
    },
    {
      title: "Excluded by design",
      rows: [
        ["Restricted", snapshot.boundaries.restricted || "excluded"],
        ["Session exports", snapshot.boundaries.sources || "excluded"],
        ["Outreach", snapshot.boundaries.outreach || "draft-only"],
        ["Operations", snapshot.boundaries.operations || "not-instrumented"],
      ],
    },
  ];
  return (
    <div className="space-y-10">
      <div className="grid gap-3 md:grid-cols-2">
        {groups.map((group) => (
          <Card key={group.title}>
            <CardHeader>
              <CardTitle>{group.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3">
                {group.rows.map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="flex items-center justify-between gap-4 border-b pb-2 last:border-0 last:pb-0"
                  >
                    <dt className="text-sm text-muted-foreground">{label}</dt>
                    <dd className="text-right text-sm font-medium">
                      {String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>
      <section>
        <SectionHeading
          title="Read-only boundaries"
          note="Local and read-only"
        />
        <ul className="grid gap-3 border bg-card p-5 text-sm leading-relaxed text-muted-foreground">
          <li>
            Canonical entities are parsed from committed Git HEAD, not dirty
            working-tree files.
          </li>
          <li>
            Restricted context and session exports are excluded before data
            reaches the browser.
          </li>
          <li>
            Markdown is displayed as text; embedded HTML is never executed.
          </li>
          <li>
            No send, schedule, apply, write, shell, or arbitrary-file control is
            present.
          </li>
        </ul>
      </section>
    </div>
  );
}
