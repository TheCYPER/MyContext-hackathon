export function SectionHeading({
  title,
  note,
}: {
  title: string;
  note?: string;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-2 border-b pb-3">
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      {note && <p className="text-xs font-medium text-muted-foreground">{note}</p>}
    </div>
  );
}
