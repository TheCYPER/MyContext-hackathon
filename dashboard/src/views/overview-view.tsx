import { Briefcase } from "@phosphor-icons/react/Briefcase";
import { Flask } from "@phosphor-icons/react/Flask";
import { FolderSimple } from "@phosphor-icons/react/FolderSimple";
import { Notebook } from "@phosphor-icons/react/Notebook";

import { academicContextCounts, rankWorkstreams } from "../lib/model.mjs";
import type { DashboardSnapshot } from "../types";
import { WorkstreamCard } from "../components/workstream-card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { reviewPrompt } from "../components/layout/review-sheet";
import { cn } from "../lib/utils";
import { SectionHeading } from "./section-heading";

export function OverviewView({
  snapshot,
  onOpenEntity,
  onSelectView,
}: {
  snapshot: DashboardSnapshot;
  onOpenEntity: (id: string) => void;
  onSelectView: (view: "projects" | "experience" | "ideas") => void;
}) {
  const counts = academicContextCounts(snapshot.entities);
  const summaries = [
    {
      label: "Projects",
      value: counts.projects,
      icon: FolderSimple,
      view: "projects" as const,
      tone: "bg-palette-green",
      valueTone: "text-palette-black",
      metaTone: "bg-palette-black text-palette-cream",
      focusTone: "focus-visible:ring-palette-black",
    },
    {
      label: "Experiences",
      value: counts.experience,
      icon: Briefcase,
      view: "experience" as const,
      tone: "bg-palette-terracotta",
      valueTone: "text-palette-black",
      metaTone: "bg-palette-black text-palette-cream",
      focusTone: "focus-visible:ring-palette-black",
    },
    {
      label: "Research ideas",
      value: counts.researchIdeas,
      icon: Flask,
      view: "ideas" as const,
      tone: "bg-palette-cream",
      valueTone: "text-palette-black",
      metaTone: "bg-palette-black text-palette-cream",
      focusTone: "focus-visible:ring-palette-black",
    },
    {
      label: "Project ideas",
      value: counts.projectIdeas,
      icon: Notebook,
      view: "ideas" as const,
      tone: "bg-palette-black",
      valueTone: "text-palette-cream",
      metaTone: "bg-palette-cream text-palette-black",
      focusTone: "focus-visible:ring-palette-cream",
    },
  ];
  const workstreams = rankWorkstreams(snapshot.workstreams).slice(0, 4);
  return (
    <div className="space-y-12">
      <nav
        aria-label="Academic and professional records"
        className="grid gap-px border bg-border sm:grid-cols-2 xl:grid-cols-4"
      >
        {summaries.map(
          ({
            label,
            value,
            icon: Icon,
            view,
            tone,
            valueTone,
            metaTone,
            focusTone,
          }) => (
            <button
              key={label}
              type="button"
              className={cn(
                "group p-5 text-left transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset",
                tone,
                focusTone,
              )}
              onClick={() => onSelectView(view)}
            >
              <span
                className={cn(
                  "flex items-center justify-between px-2 py-1",
                  metaTone,
                )}
              >
                <Icon className="size-4" />
                <span className="text-[0.68rem] font-bold uppercase tracking-[0.12em]">
                  Open
                </span>
              </span>
              <strong
                className={cn(
                  "mt-6 block text-3xl font-bold tabular-nums",
                  valueTone,
                )}
              >
                {value}
              </strong>
              <span
                className={cn(
                  "mt-1 inline-block px-2 py-1 text-sm font-bold",
                  metaTone,
                )}
              >
                {label}
              </span>
              <span className="sr-only">
                {value} {label}
              </span>
            </button>
          ),
        )}
      </nav>
      <section>
        <SectionHeading
          title="Current focus"
          note="Saved results, questions, and next steps"
        />
        <div className="grid gap-3">
          {workstreams.map((item: (typeof snapshot.workstreams)[number]) => (
            <WorkstreamCard
              key={item.id}
              workstream={item}
              entities={snapshot.entities}
              onOpenEntity={onOpenEntity}
            />
          ))}
        </div>
      </section>
      <section>
        <SectionHeading
          title="Needs your review"
          note={`${snapshot.reviewItems.length} read-only review item${snapshot.reviewItems.length === 1 ? "" : "s"}`}
        />
        <div className="grid gap-3 md:grid-cols-2">
          {snapshot.reviewItems.slice(0, 4).map((item) => (
            <Card key={item.id}>
              <CardContent className="p-5">
                <Badge variant="signal">Draft · manual review</Badge>
                <h3 className="mt-3 font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {reviewPrompt(item)}
                </p>
                {item.entityId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => onOpenEntity(item.entityId!)}
                  >
                    Inspect context
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
