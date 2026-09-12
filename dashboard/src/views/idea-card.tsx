import type { DashboardSnapshot, Entity } from "../types";
import { RelationTrail } from "../components/relation-trail";
import { StatusBadge } from "../components/status-badge";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";

export function EntityIdeaCard({ idea, snapshot, onOpenEntity, onOpenGraph }: { idea: Entity; snapshot: DashboardSnapshot; onOpenEntity: (id: string) => void; onOpenGraph: (id: string) => void }) {
  const title = idea.ideaKind === "research" ? idea.submission?.projectTitle || idea.title : idea.title;
  return <Card><CardContent className="p-5"><div className="flex items-center justify-between gap-3"><Badge variant="secondary">{idea.ideaKind === "research" ? "Research question" : "Project idea"}</Badge><StatusBadge status={idea.status} /></div><Button type="button" variant="link" className="mt-4 h-auto justify-start p-0 text-left text-base font-semibold text-foreground" onClick={() => onOpenEntity(idea.id)}>{title}</Button>{idea.ideaKind === "research" ? <div className="mt-4 grid gap-3"><div className="rounded-lg bg-muted/60 p-3"><h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Project description</h4><p className="mt-1 text-sm leading-relaxed">{idea.submission?.projectDescription || idea.summary}</p></div><div className="rounded-lg bg-muted/60 p-3"><h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Advisor help</h4><p className="mt-1 text-sm leading-relaxed">{idea.submission?.advisorHelp || "No advisor-help statement is projected."}</p></div></div> : <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{idea.summary || "No problem statement is projected."}</p>}<RelationTrail record={idea} entities={snapshot.entities} edges={snapshot.graph.edges} onOpenEntity={onOpenEntity} onOpenGraph={onOpenGraph} /></CardContent></Card>;
}
