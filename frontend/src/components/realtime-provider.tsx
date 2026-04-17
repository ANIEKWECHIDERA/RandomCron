import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createRealtimeConnection, type ConnectionStatus } from "@/lib/realtime";

const RealtimeContext = createContext<ConnectionStatus>("Disconnected");

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ConnectionStatus>("Disconnected");

  useEffect(() => createRealtimeConnection(queryClient, setStatus), [queryClient]);

  const value = useMemo(() => status, [status]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtimeStatus() {
  return useContext(RealtimeContext);
}
