import { rankWorkstreams } from "../lib/model.mjs";
import type { DashboardSnapshot } from "../types";
import { EmptyState } from "../components/empty-state";
import { WorkstreamCard } from "../components/workstream-card";
import { SectionHeading } from "./section-heading";

export function WorkstreamsView({ snapshot, onOpenEntity }: { snapshot: DashboardSnapshot; onOpenEntity: (id: string) => void }) {
  const workstreams = rankWorkstreams(snapshot.workstreams);
  return <section><SectionHeading title="Current projects" note={`${workstreams.length} saved project records`} />{workstreams.length ? <div className="grid gap-3">{workstreams.map((item: typeof snapshot.workstreams[number]) => <WorkstreamCard key={item.id} workstream={item} entities={snapshot.entities} onOpenEntity={onOpenEntity} />)}</div> : <EmptyState title="No project context is visible." description="Only tracked, non-restricted project records appear here." />}</section>;
}
