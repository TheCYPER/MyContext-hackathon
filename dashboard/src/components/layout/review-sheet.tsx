import { ClipboardCheck, ShieldCheck } from "lucide-react";
import { useState } from "react";

import type { ReviewItem } from "../../types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "../ui/sheet";

export function reviewPrompt(item: ReviewItem) {
  return item.kind === "draft"
    ? "Check its claims and disclosure boundary against linked evidence. This draft is not finalized, signed, sent, or otherwise recorded as used."
    : "Review the proposed context change before any durable update.";
}

export function ReviewSheet({ items, onOpenEntity }: { items: ReviewItem[]; onOpenEntity: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="secondary" className="shrink-0"><ClipboardCheck /> <span className="hidden lg:inline">Needs your review</span><Badge variant="outline">{items.length}</Badge></Button>
      </SheetTrigger>
      <SheetContent aria-describedby="review-description">
        <SheetHeader>
          <SheetTitle className="pr-8 text-xl">Needs your review</SheetTitle>
          <SheetDescription id="review-description">Draft records waiting for a manual decision.</SheetDescription>
        </SheetHeader>
        <ScrollArea className="-mx-2 flex-1 px-2">
          <div className="grid gap-3 py-2">
            {items.length ? items.map((item) => (
              <article key={item.id} className="rounded-xl border bg-card p-4">
                <Badge variant="secondary">Draft · manual review</Badge>
                <h3 className="mt-3 font-semibold leading-snug">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{reviewPrompt(item)}</p>
                {item.entityId && <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => { setOpen(false); onOpenEntity(item.entityId!); }}>Inspect draft</Button>}
              </article>
            )) : <p className="py-8 text-center text-sm text-muted-foreground">Nothing needs your decision.</p>}
          </div>
        </ScrollArea>
        <SheetFooter>
          <div className="flex gap-3 rounded-xl bg-muted p-4 text-xs leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" /><p><strong className="text-foreground">Review only.</strong> This dashboard cannot send messages or change your records. Review proposed updates with your AI.</p></div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
