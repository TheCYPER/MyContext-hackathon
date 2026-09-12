import type { DashboardSnapshot, Entity, EntityType } from "../types";
import { EmptyState } from "../components/empty-state";
import { RecordCard } from "../components/record-card";
import { SectionHeading } from "./section-heading";

const titles: Record<string, string> = { person: "People records", project: "Project records", experience: "Work experience records" };

export function RecordsView({ type, snapshot, records, onOpenEntity, onOpenGraph }: { type: EntityType; snapshot: DashboardSnapshot; records: Entity[]; onOpenEntity: (id: string) => void; onOpenGraph: (id: string) => void }) {
  const visible = records.filter((entity) => entity.type === type && entity.role !== "research").sort((a, b) => a.title.localeCompare(b.title));
  const noun = titles[type] || "Canonical records";
  return <section><SectionHeading title={noun} note={`${visible.length} visible from tracked Git HEAD`} />{visible.length ? <div className="grid gap-3 lg:grid-cols-2">{visible.map((entity) => <RecordCard key={entity.id} entity={entity} entities={snapshot.entities} edges={snapshot.graph.edges} onOpenEntity={onOpenEntity} onOpenGraph={onOpenGraph} />)}</div> : <EmptyState title={`No ${noun.toLowerCase()} match this view.`} description="Change the search text or return to all context." />}</section>;
}
