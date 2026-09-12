import { FileText, GitCommitHorizontal } from "lucide-react";
import { useEffect, useState } from "react";

import { getEntity } from "../lib/api";
import type { Entity } from "../types";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import { Skeleton } from "./ui/skeleton";

const detailCache = new Map<string, { entity: Entity; revision: string }>();

export function EntityInspector({ entityId, summary, revision, onOpenChange }: { entityId: string | null; summary?: Entity; revision: string; onOpenChange: (open: boolean) => void }) {
  const [detail, setDetail] = useState<{ entity: Entity; revision: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!entityId) { setDetail(null); setError(null); return; }
    const cached = detailCache.get(entityId);
    if (cached) { setDetail(cached); setError(null); return; }
    let active = true;
    setDetail(null);
    setError(null);
    getEntity(entityId).then((value) => {
      if (!active) return;
      detailCache.set(entityId, value);
      setDetail(value);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Could not load this record");
    });
    return () => { active = false; };
  }, [entityId]);

  const entity = detail?.entity || summary;
  return (
    <Dialog open={Boolean(entityId)} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[88vh] grid-rows-[auto_minmax(0,1fr)_auto] p-0">
        <DialogHeader className="border-b px-6 pb-5 pt-6">
          <div className="flex flex-wrap items-center gap-2 pr-8"><Badge variant="secondary">{entity?.type || "record"}</Badge><Badge variant="outline">{entity?.privacy || "loading"}</Badge></div>
          <DialogTitle className="pr-8 text-xl">{entity?.title || "Loading record…"}</DialogTitle>
          <DialogDescription>Canonical record projected from committed context.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 px-6 py-5">
          {!detail && !error && <div className="grid gap-3"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /><Skeleton className="mt-3 h-32 w-full" /></div>}
          {error && <div role="alert" className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">{error}</div>}
          {detail && <><div className="flex flex-wrap gap-2">{detail.entity.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}</div><pre className="mt-5 whitespace-pre-wrap break-words font-sans text-sm leading-7 text-foreground">{detail.entity.body || detail.entity.summary || "No body text is available."}</pre></>}
        </ScrollArea>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/35 px-6 py-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><FileText className="size-3.5" />{entity?.path || "Canonical path unavailable"}</span><span className="inline-flex items-center gap-1.5"><GitCommitHorizontal className="size-3.5" />Read from tracked Git HEAD · {(detail?.revision || revision).slice(0, 8)}</span></footer>
      </DialogContent>
    </Dialog>
  );
}
