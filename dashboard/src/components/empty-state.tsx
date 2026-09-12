import { Inbox } from "lucide-react";

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="grid place-items-center rounded-xl border border-dashed px-6 py-12 text-center"><Inbox className="size-6 text-muted-foreground" /><h3 className="mt-3 font-medium">{title}</h3><p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p></div>;
}
