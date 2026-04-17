import type { QueryClient } from "@tanstack/react-query";
import type { ChartData, Cronjob, CronjobExecution, DashboardStats } from "@/types";
import { queryKeys } from "./query-keys";

export type ConnectionStatus = "Live" | "Reconnecting" | "Disconnected";

export interface RealtimeEvent {
  id: string;
  eventType: string;
  emittedAt: string;
  cronjobId?: string;
  executionId?: string;
  cronjobTitle?: string;
  cronjob?: Cronjob;
  execution?: CronjobExecution;
  status?: string;
  success?: boolean;
  statusCode?: number | null;
  statusText?: string | null;
  durationMs?: number;
  consecutiveFailures?: number;
  retryAttempt?: number;
  startedAt?: string;
  completedAt?: string;
  nextExecutionAt?: string | null;
  responsePreview?: string | null;
}

export function createRealtimeConnection(
  queryClient: QueryClient,
  onStatusChange: (status: ConnectionStatus) => void,
) {
  let source: EventSource | null = null;
  let closed = false;

  const connect = () => {
    onStatusChange(source ? "Reconnecting" : "Disconnected");
    source?.close();
    source = new EventSource("/api/realtime/events");

    source.onopen = () => onStatusChange("Live");
    source.onerror = () => onStatusChange("Reconnecting");

    const handler = (message: MessageEvent<string>) => {
      const event = JSON.parse(message.data) as RealtimeEvent;
      applyRealtimeEvent(queryClient, event);
    };

    for (const eventType of [
      "connected",
      "cronjob.created",
      "cronjob.updated",
      "cronjob.enabled",
      "cronjob.disabled",
      "cronjob.deleted",
      "cronjob.scheduled",
      "execution.started",
      "execution.succeeded",
      "execution.failed",
      "execution.retry_changed",
      "cronjob.failure_count_changed",
      "cronjob.final_stopped",
    ]) {
      source.addEventListener(eventType, handler as EventListener);
    }
  };

  connect();

  return () => {
    closed = true;
    source?.close();
    if (closed) {
      onStatusChange("Disconnected");
    }
  };
}

export function applyRealtimeEvent(queryClient: QueryClient, event: RealtimeEvent) {
  if (event.eventType === "connected") return;

  if (event.eventType === "cronjob.deleted" && event.cronjobId) {
    queryClient.setQueryData<{ data: Cronjob[] }>(queryKeys.cronjobs, (current) =>
      current ? { data: current.data.filter((job) => job.id !== event.cronjobId) } : current,
    );
    queryClient.removeQueries({ queryKey: queryKeys.cronjob(event.cronjobId) });
    queryClient.removeQueries({ queryKey: queryKeys.history(event.cronjobId) });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    return;
  }

  if (event.cronjob) {
    upsertCronjob(queryClient, event.cronjob);
  } else if (event.cronjobId) {
    patchCronjob(queryClient, event);
  }

  if (event.execution) {
    const execution = {
      ...event.execution,
      cronjobTitle: event.cronjobTitle ?? event.execution.cronjobTitle,
    };
    upsertExecution(queryClient, execution);
    patchDashboardFromExecution(queryClient, execution);
  }

  if (event.eventType.startsWith("cronjob.") || event.eventType.startsWith("execution.")) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.stats, refetchType: "active" });
    void queryClient.invalidateQueries({ queryKey: queryKeys.failureStreaks, refetchType: "active" });
  }
}

function upsertCronjob(queryClient: QueryClient, cronjob: Cronjob) {
  queryClient.setQueryData<{ data: Cronjob[] }>(queryKeys.cronjobs, (current) => {
    if (!current) return { data: [cronjob] };
    const exists = current.data.some((job) => job.id === cronjob.id);
    return {
      data: exists
        ? current.data.map((job) => (job.id === cronjob.id ? { ...job, ...cronjob } : job))
        : [cronjob, ...current.data],
    };
  });

  queryClient.setQueryData<{ data: Cronjob }>(queryKeys.cronjob(cronjob.id), (current) =>
    current ? { data: { ...current.data, ...cronjob } } : { data: cronjob },
  );
}

function patchCronjob(queryClient: QueryClient, event: RealtimeEvent) {
  if (!event.cronjobId) return;
  const patch: Partial<Cronjob> = {
    currentStatus: event.status,
    consecutiveFailures: event.consecutiveFailures,
    nextExecutionAt: event.nextExecutionAt ?? undefined,
  };

  queryClient.setQueryData<{ data: Cronjob[] }>(queryKeys.cronjobs, (current) =>
    current
      ? {
          data: current.data.map((job) =>
            job.id === event.cronjobId ? ({ ...job, ...definedOnly(patch) } as Cronjob) : job,
          ),
        }
      : current,
  );
  queryClient.setQueryData<{ data: Cronjob }>(queryKeys.cronjob(event.cronjobId), (current) =>
    current ? { data: { ...current.data, ...definedOnly(patch) } } : current,
  );
}

function upsertExecution(queryClient: QueryClient, execution: CronjobExecution) {
  queryClient.setQueryData<{ data: CronjobExecution[]; meta: { page: number; pageSize: number; total: number } }>(
    queryKeys.history(execution.cronjobId),
    (current) => {
      if (!current) return current;
      const exists = current.data.some((item) => item.id === execution.id);
      return {
        meta: { ...current.meta, total: exists ? current.meta.total : current.meta.total + 1 },
        data: exists ? current.data.map((item) => (item.id === execution.id ? execution : item)) : [execution, ...current.data].slice(0, current.meta.pageSize),
      };
    },
  );

  queryClient.setQueryData<{ data: Cronjob }>(queryKeys.cronjob(execution.cronjobId), (current) =>
    current
      ? {
          data: {
            ...current.data,
            lastExecutionAt: execution.completedAt,
            lastSuccessAt: execution.success ? execution.completedAt : current.data.lastSuccessAt,
            lastFailureAt: execution.success ? current.data.lastFailureAt : execution.completedAt,
            latestExecution: execution,
          },
        }
      : current,
  );
}

function patchDashboardFromExecution(queryClient: QueryClient, execution: CronjobExecution) {
  queryClient.setQueryData<{ data: CronjobExecution[] }>(queryKeys.recentEvents, (current) => {
    if (!current) return current;
    const exists = current.data.some((item) => item.id === execution.id);
    return {
      data: exists ? current.data.map((item) => (item.id === execution.id ? execution : item)) : [execution, ...current.data].slice(0, 12),
    };
  });

  queryClient.setQueryData<{ data: ChartData }>(queryKeys.charts, (current) => {
    if (!current) return current;
    const label = new Date(execution.startedAt).toISOString().slice(11, 19);
    return {
      data: {
        responseTimes: [
          ...current.data.responseTimes,
          { timestamp: execution.startedAt, label, durationMs: execution.durationMs, cronjobTitle: execution.cronjobTitle ?? "Cronjob" },
        ].slice(-100),
        successFailure: [
          ...current.data.successFailure,
          { timestamp: execution.startedAt, label, success: execution.success ? 1 : 0, failure: execution.success ? 0 : 1 },
        ].slice(-100),
      },
    };
  });

  queryClient.setQueryData<{ data: DashboardStats }>(queryKeys.stats, (current) => current);
}

function definedOnly<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)) as Partial<T>;
}
