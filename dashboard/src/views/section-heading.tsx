export function SectionHeading({ title, note }: { title: string; note?: string }) {
  return <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><h2 className="text-lg font-semibold tracking-tight">{title}</h2>{note && <p className="text-xs text-muted-foreground">{note}</p>}</div>;
}
