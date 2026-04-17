import { Badge } from "@/components/ui/badge";
import { statusTone } from "@/lib/format";

export function StatusBadge({ status, enabled }: { status: string; enabled?: boolean }) {
  return (
    <Badge variant={statusTone(status, enabled) as "default" | "secondary" | "destructive" | "outline"}>
      {enabled === false ? "disabled" : status}
    </Badge>
  );
}
