import { Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ConnectionStatus } from "@/lib/realtime";

export function LiveStatus({ status }: { status: ConnectionStatus }) {
  const live = status === "Live";
  return (
    <Badge variant={live ? "default" : "secondary"} className="gap-1">
      {live ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
      {status}
    </Badge>
  );
}
