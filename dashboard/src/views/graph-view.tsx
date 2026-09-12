import { EmptyState } from "../components/empty-state";
import type { DashboardSnapshot } from "../types";
import { SectionHeading } from "./section-heading";

export function GraphView({ snapshot }: { snapshot: DashboardSnapshot }) {
  return <section><SectionHeading title="Context graph" note="One hop by default · connections follow recorded links" />{snapshot.graph.nodes.length ? <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Relationship explorer loading in the next implementation slice.</div> : <EmptyState title="No visible relationship exists yet." description="The graph only uses visible canonical frontmatter links." />}</section>;
}
