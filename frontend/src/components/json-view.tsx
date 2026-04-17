export function JsonView({ value }: { value?: string | null }) {
  if (!value) {
    return <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">No body captured.</div>;
  }

  let display = value;
  try {
    display = JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    display = value;
  }

  return (
    <pre className="max-h-[520px] overflow-auto rounded-md border bg-muted/40 p-4 text-sm leading-6">
      {display}
    </pre>
  );
}
