export function formatDate(value?: string | null) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Never";
}

export function formatDuration(ms?: number | null) {
  if (!ms) return "0 ms";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function statusTone(status: string, enabled?: boolean) {
  if (!enabled) return "secondary";
  if (status === "success") return "default";
  if (status === "failed" || status === "stopped") return "destructive";
  if (status === "running") return "outline";
  return "secondary";
}
