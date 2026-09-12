import { Skeleton } from "./ui/skeleton";

export function LoadingState() {
  return <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6"><Skeleton className="h-4 w-40" /><Skeleton className="mt-4 h-10 w-[min(28rem,90%)]" /><Skeleton className="mt-3 h-5 w-[min(38rem,100%)]" /><div className="mt-10 grid gap-4 md:grid-cols-2"><Skeleton className="h-44" /><Skeleton className="h-44" /><Skeleton className="h-44" /><Skeleton className="h-44" /></div></div>;
}
