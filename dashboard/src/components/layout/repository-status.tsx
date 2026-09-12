import { AlertCircle, CheckCircle2 } from "lucide-react";

import type { DashboardSnapshot, RepoStatus } from "../../types";

const shortRevision = (revision?: string) => revision ? revision.slice(0, 8) : "unavailable";

export function RepositoryStatus({ repo, snapshot, error }: { repo: RepoStatus | null; snapshot: DashboardSnapshot | null; error: string | null }) {
  if (!snapshot) return <span className="text-xs text-muted-foreground">Projection unavailable</span>;
  if (!repo || error) return <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300"><AlertCircle className="size-3.5" />{shortRevision(snapshot.revision)} · repository status unavailable</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" title={repo.dirty ? "Local changes are not projected" : "Working tree clean"}>
      {repo.dirty ? <AlertCircle className="size-3.5 text-amber-600" /> : <CheckCircle2 className="size-3.5 text-emerald-600" />}
      {repo.branch || "detached HEAD"} · {shortRevision(repo.revision || snapshot.revision)}
    </span>
  );
}
