import { CheckCircle as CheckCircle2 } from "@phosphor-icons/react/CheckCircle";
import { WarningCircle as AlertCircle } from "@phosphor-icons/react/WarningCircle";

import type { DashboardSnapshot, RepoStatus } from "../../types";

const shortRevision = (revision?: string) =>
  revision ? revision.slice(0, 8) : "unavailable";

export function RepositoryStatus({
  repo,
  snapshot,
  error,
}: {
  repo: RepoStatus | null;
  snapshot: DashboardSnapshot | null;
  error: string | null;
}) {
  if (!snapshot)
    return (
      <span className="text-xs text-muted-foreground">
        Projection unavailable
      </span>
    );
  if (!repo || error)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
        <AlertCircle className="size-3.5 text-signal" />
        {shortRevision(snapshot.revision)} · repository status unavailable
      </span>
    );
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
      title={
        repo.dirty ? "Local changes are not projected" : "Working tree clean"
      }
    >
      {repo.dirty ? (
        <AlertCircle className="size-3.5 text-signal" />
      ) : (
        <CheckCircle2 className="size-3.5 text-primary" />
      )}
      {repo.branch || "detached HEAD"} ·{" "}
      {shortRevision(repo.revision || snapshot.revision)}
    </span>
  );
}
