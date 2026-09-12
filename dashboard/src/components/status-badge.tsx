import { cn } from "../lib/utils";
import { Badge } from "./ui/badge";

export function StatusBadge({ status = "unknown" }: { status?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "capitalize",
        status === "active" && "border-primary bg-primary/10 text-foreground",
        status === "draft" && "border-signal bg-signal/10 text-foreground",
        status === "archived" && "text-muted-foreground",
      )}
    >
      {status}
    </Badge>
  );
}
