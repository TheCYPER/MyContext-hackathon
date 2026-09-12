import type { ReactNode } from "react";

import { cn } from "../lib/utils";

export type StatusLayout = "featured" | "working" | "compact" | "standard";

type StatusKey = "active" | "draft" | "archived" | "other";

const STATUS_ORDER: StatusKey[] = ["active", "draft", "archived", "other"];

const STATUS_META: Record<
  StatusKey,
  {
    title: string;
    note: string;
    layout: StatusLayout;
    tone: string;
    grid: string;
  }
> = {
  active: {
    title: "Active",
    note: "Current and available now",
    layout: "featured",
    tone: "border-primary",
    grid: "grid gap-3 lg:grid-cols-2",
  },
  draft: {
    title: "In progress",
    note: "Still being shaped or reviewed",
    layout: "working",
    tone: "border-signal",
    grid: "grid gap-3 md:grid-cols-2",
  },
  archived: {
    title: "Archived",
    note: "Parked history kept for reference",
    layout: "compact",
    tone: "border-foreground",
    grid: "grid gap-px border bg-border",
  },
  other: {
    title: "Other",
    note: "Records with another lifecycle state",
    layout: "standard",
    tone: "border-foreground",
    grid: "grid gap-3",
  },
};

function statusKey(status: string): StatusKey {
  const normalized = status.trim().toLowerCase();
  if (
    normalized === "active" ||
    normalized === "draft" ||
    normalized === "archived"
  ) {
    return normalized;
  }
  return "other";
}

export function StatusCollection<
  T extends { id: string; status: string; title: string },
>({
  items,
  labelPrefix,
  renderItem,
}: {
  items: T[];
  labelPrefix?: string;
  renderItem: (item: T, layout: StatusLayout) => ReactNode;
}) {
  const groups = new Map<StatusKey, T[]>(STATUS_ORDER.map((key) => [key, []]));

  for (const item of items) groups.get(statusKey(item.status))!.push(item);
  for (const values of groups.values()) {
    values.sort((left, right) => left.title.localeCompare(right.title));
  }

  return (
    <div className="space-y-8">
      {STATUS_ORDER.map((key) => {
        const values = groups.get(key)!;
        if (!values.length) return null;
        const meta = STATUS_META[key];
        const accessibleName = labelPrefix
          ? `${labelPrefix} — ${meta.title}`
          : `${meta.title} records`;

        return (
          <section
            key={key}
            aria-label={accessibleName}
            data-layout={meta.layout}
          >
            <div className={cn("mb-3 border-l-4 pl-3", meta.tone)}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-xl font-black tracking-tight">
                  {meta.title}
                </h3>
                <span className="text-sm font-bold tabular-nums">
                  {values.length} {values.length === 1 ? "record" : "records"}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{meta.note}</p>
            </div>
            <div className={meta.grid}>
              {values.map((item) => renderItem(item, meta.layout))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
