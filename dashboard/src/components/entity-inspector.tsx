import { FileText, GitCommitHorizontal, Network } from "lucide-react";
import { useEffect, useState } from "react";

import { getEntity } from "../lib/api";
import type { Entity } from "../types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import { Skeleton } from "./ui/skeleton";

const detailCache = new Map<string, { entity: Entity; revision: string }>();

export function EntityInspector({ entityId, summary, revision, entities, onFocusGraph, onOpenChange }: { entityId: string | null; summary?: Entity; revision: string; entities: Entity[]; onFocusGraph: (id: string) => void; onOpenChange: (open: boolean) => void }) {
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
  const outgoing = entity?.links || [];
  const incoming = entity ? entities.filter((candidate) => candidate.links.includes(entity.id)).map((candidate) => candidate.id) : [];
  const byId = new Map(entities.map((candidate) => [candidate.id, candidate]));
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
          {detail && <div className="space-y-6"><div className="flex flex-wrap gap-2">{detail.entity.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}</div><dl className="grid gap-3 rounded-xl bg-muted/55 p-4 text-sm sm:grid-cols-3"><div><dt className="text-xs text-muted-foreground">Status</dt><dd className="mt-1 font-medium">{detail.entity.status}</dd></div><div><dt className="text-xs text-muted-foreground">Role</dt><dd className="mt-1 font-medium">{detail.entity.role || "Not recorded"}</dd></div><div><dt className="text-xs text-muted-foreground">Updated</dt><dd className="mt-1 font-medium">{detail.entity.updated || "Not recorded"}</dd></div></dl>{detail.entity.sections?.length ? <div className="space-y-5">{detail.entity.sections.map((section, index) => <section key={`${section.title}-${index}`}><h3 className="font-semibold">{section.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-7">{section.body}</p></section>)}</div> : <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-foreground">{detail.entity.body || detail.entity.summary || "No body text is available."}</pre>}<section><h3 className="text-sm font-semibold">Sources</h3><ul className="mt-2 grid gap-1 text-sm text-muted-foreground">{detail.entity.sources.length ? detail.entity.sources.map((source) => <li key={source}>{source}</li>) : <li>No source locator recorded.</li>}</ul></section><section><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Recorded relationships</h3><Button type="button" variant="outline" size="sm" onClick={() => onFocusGraph(detail.entity.id)}><Network />Focus in graph</Button></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><div><h4 className="text-xs uppercase tracking-wide text-muted-foreground">Outgoing</h4>{outgoing.length ? outgoing.map((id) => <p key={id} className="mt-1 text-sm">{byId.get(id)?.title || id}</p>) : <p className="mt-1 text-sm text-muted-foreground">None recorded</p>}</div><div><h4 className="text-xs uppercase tracking-wide text-muted-foreground">Incoming</h4>{incoming.length ? incoming.map((id) => <p key={id} className="mt-1 text-sm">{byId.get(id)?.title || id}</p>) : <p className="mt-1 text-sm text-muted-foreground">None recorded</p>}</div></div></section></div>}
        </ScrollArea>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/35 px-6 py-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><FileText className="size-3.5" />{entity?.path || "Canonical path unavailable"}</span><span className="inline-flex items-center gap-1.5"><GitCommitHorizontal className="size-3.5" />Read from tracked Git HEAD · {(detail?.revision || revision).slice(0, 8)}</span></footer>
      </DialogContent>
    </Dialog>
  );
}
