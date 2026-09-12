export function SectionHeading({
  title,
  note,
}: {
  title: string;
  note?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b pb-4">
      <h2 className="text-2xl font-black leading-none tracking-tight sm:text-3xl">
        {title}
      </h2>
      {note && (
        <p className="text-sm font-semibold text-muted-foreground">{note}</p>
      )}
    </div>
  );
}
