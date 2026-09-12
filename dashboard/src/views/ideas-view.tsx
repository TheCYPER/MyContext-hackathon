import type { DashboardSnapshot, Entity } from "../types";
import { EntityIdeaCard } from "./idea-card";
import { EmptyState } from "../components/empty-state";
import { StatusCollection } from "../components/status-collection";
import { SectionHeading } from "./section-heading";

export function IdeasView({
  snapshot,
  records,
  onOpenEntity,
  onOpenGraph,
}: {
  snapshot: DashboardSnapshot;
  records: Entity[];
  onOpenEntity: (id: string) => void;
  onOpenGraph: (id: string) => void;
}) {
  const ideas = records.filter((entity) => entity.type === "idea");
  const research = ideas.filter((idea) => idea.ideaKind === "research");
  const projects = ideas.filter((idea) => idea.ideaKind === "project");
  const group = (items: Entity[], label: string, empty: string) =>
    items.length ? (
      <StatusCollection
        items={items}
        labelPrefix={label}
        renderItem={(idea, layout) => (
          <EntityIdeaCard
            key={idea.id}
            idea={idea}
            snapshot={snapshot}
            layout={layout}
            onOpenEntity={onOpenEntity}
            onOpenGraph={onOpenGraph}
          />
        )}
      />
    ) : (
      <EmptyState
        title={empty}
        description="Change the search text or add a canonical idea."
      />
    );
  return (
    <div className="space-y-12">
      <section>
        <SectionHeading
          title="Research ideas"
          note={`${research.length} questions to discuss`}
        />
        {group(
          research,
          "Research ideas",
          "No research idea matches this view.",
        )}
      </section>
      <section>
        <SectionHeading
          title="Project ideas"
          note={`${projects.length} possible builds to explore`}
        />
        {group(projects, "Project ideas", "No project idea matches this view.")}
      </section>
    </div>
  );
}
