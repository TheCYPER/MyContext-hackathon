import { BriefcaseBusiness, FolderKanban, Lightbulb, Microscope } from "lucide-react";

import { academicContextCounts, rankWorkstreams } from "../lib/model.mjs";
import type { DashboardSnapshot } from "../types";
import { WorkstreamCard } from "../components/workstream-card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { reviewPrompt } from "../components/layout/review-sheet";
import { SectionHeading } from "./section-heading";

export function OverviewView({ snapshot, onOpenEntity, onSelectView }: { snapshot: DashboardSnapshot; onOpenEntity: (id: string) => void; onSelectView: (view: "projects" | "experience" | "ideas") => void }) {
  const counts = academicContextCounts(snapshot.entities);
  const summaries = [
    { label: "Projects", value: counts.projects, icon: FolderKanban, view: "projects" as const },
    { label: "Experiences", value: counts.experience, icon: BriefcaseBusiness, view: "experience" as const },
    { label: "Research ideas", value: counts.researchIdeas, icon: Microscope, view: "ideas" as const },
    { label: "Project ideas", value: counts.projectIdeas, icon: Lightbulb, view: "ideas" as const },
  ];
  const workstreams = rankWorkstreams(snapshot.workstreams).slice(0, 4);
  return <div className="space-y-10"><nav aria-label="Academic and professional records" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{summaries.map(({ label, value, icon: Icon, view }) => <button key={label} type="button" className="group rounded-xl border bg-card p-4 text-left shadow-sm transition hover:border-primary/30 hover:bg-accent/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onSelectView(view)}><span className="flex items-center justify-between text-muted-foreground"><Icon className="size-4" /><span className="text-xs">Open</span></span><strong className="mt-4 block text-2xl">{value}</strong><span className="text-sm text-muted-foreground">{label}</span><span className="sr-only">{value} {label}</span></button>)}</nav><section><SectionHeading title="Current focus" note="Saved results, questions, and next steps" /><div className="grid gap-3">{workstreams.map((item: typeof snapshot.workstreams[number]) => <WorkstreamCard key={item.id} workstream={item} entities={snapshot.entities} onOpenEntity={onOpenEntity} />)}</div></section><section><SectionHeading title="Needs your review" note={`${snapshot.reviewItems.length} read-only review item${snapshot.reviewItems.length === 1 ? "" : "s"}`} /><div className="grid gap-3 md:grid-cols-2">{snapshot.reviewItems.slice(0, 4).map((item) => <Card key={item.id}><CardContent className="p-5"><Badge variant="secondary">Draft · manual review</Badge><h3 className="mt-3 font-semibold">{item.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{reviewPrompt(item)}</p>{item.entityId && <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => onOpenEntity(item.entityId!)}>Inspect context</Button>}</CardContent></Card>)}</div></section></div>;
}
