import { EmptyState } from "../components/empty-state";
import { Card, CardContent } from "../components/ui/card";
import type { DashboardSnapshot } from "../types";
import { SectionHeading } from "./section-heading";

export function RunsView({ snapshot }: { snapshot: DashboardSnapshot }) {
  return <div className="space-y-8"><section><SectionHeading title="App-managed operations" note="Ephemeral · never canonical by default" />{snapshot.operations.length ? <div className="grid gap-3">{snapshot.operations.map((operation, index) => <Card key={String(operation.id || index)}><CardContent className="p-5"><h3 className="font-semibold">{String(operation.title || operation.id || "Local operation")}</h3><p className="mt-2 text-sm text-muted-foreground">{String(operation.summary || operation.phase || "Registered with the local harness.")}</p></CardContent></Card>)}</div> : <EmptyState title="No app-managed task is running." description="Other Codex or Claude tasks are not inspected." />}</section><section><SectionHeading title="Visibility boundary" note="No background transcript watcher" /><ul className="grid gap-2 text-sm leading-relaxed text-muted-foreground"><li>MyContext does not inspect other Codex or Claude tasks.</li><li>A run must be explicitly registered before it can appear here.</li><li>Completed output still requires human review before any durable context change.</li></ul></section></div>;
}
