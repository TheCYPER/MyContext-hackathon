import { cn } from "../lib/utils";
import { Badge } from "./ui/badge";

export function StatusBadge({ status = "unknown" }: { status?: string }) {
  return <Badge variant="outline" className={cn(
    "capitalize",
    status === "active" && "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    status === "draft" && "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    status === "archived" && "text-muted-foreground",
  )}>{status}</Badge>;
}
