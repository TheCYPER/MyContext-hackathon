import type { DashboardSnapshot, Entity, EntityType } from "../types";
import { EmptyState } from "../components/empty-state";
import { RecordCard } from "../components/record-card";
import { StatusCollection } from "../components/status-collection";
import { SectionHeading } from "./section-heading";

const titles: Record<string, string> = {
  person: "People records",
  project: "Project records",
  experience: "Work experience records",
};

export function RecordsView({
  type,
  snapshot,
  records,
  onOpenEntity,
  onOpenGraph,
}: {
  type: EntityType;
  snapshot: DashboardSnapshot;
  records: Entity[];
  onOpenEntity: (id: string) => void;
  onOpenGraph: (id: string) => void;
}) {
  const visible = records.filter(
    (entity) => entity.type === type && entity.role !== "research",
  );
  const noun = titles[type] || "Canonical records";
  return (
    <section>
      <SectionHeading
        title={noun}
        note={`${visible.length} visible from tracked Git HEAD`}
      />
      {visible.length ? (
        <StatusCollection
          items={visible}
          renderItem={(entity, layout) => (
            <RecordCard
              key={entity.id}
              entity={entity}
              entities={snapshot.entities}
              edges={snapshot.graph.edges}
              layout={layout}
              onOpenEntity={onOpenEntity}
              onOpenGraph={onOpenGraph}
            />
          )}
        />
      ) : (
        <EmptyState
          title={`No ${noun.toLowerCase()} match this view.`}
          description="Change the search text or return to all context."
        />
      )}
    </section>
  );
}
