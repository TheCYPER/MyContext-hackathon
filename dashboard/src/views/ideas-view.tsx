import type { DashboardSnapshot, Entity } from "../types";
import { EntityIdeaCard } from "./idea-card";
import { EmptyState } from "../components/empty-state";
import { SectionHeading } from "./section-heading";

export function IdeasView({ snapshot, records, onOpenEntity, onOpenGraph }: { snapshot: DashboardSnapshot; records: Entity[]; onOpenEntity: (id: string) => void; onOpenGraph: (id: string) => void }) {
  const ideas = records.filter((entity) => entity.type === "idea").sort((a, b) => a.title.localeCompare(b.title));
  const research = ideas.filter((idea) => idea.ideaKind === "research");
  const projects = ideas.filter((idea) => idea.ideaKind === "project");
  const group = (items: Entity[], empty: string) => items.length ? <div className="grid gap-3 md:grid-cols-2">{items.map((idea) => <EntityIdeaCard key={idea.id} idea={idea} snapshot={snapshot} onOpenEntity={onOpenEntity} onOpenGraph={onOpenGraph} />)}</div> : <EmptyState title={empty} description="Change the search text or add a canonical idea." />;
  return <div className="space-y-10"><section><SectionHeading title="Research ideas" note={`${research.length} questions to discuss`} />{group(research, "No research idea matches this view.")}</section><section><SectionHeading title="Project ideas" note={`${projects.length} possible builds to explore`} />{group(projects, "No project idea matches this view.")}</section></div>;
}
