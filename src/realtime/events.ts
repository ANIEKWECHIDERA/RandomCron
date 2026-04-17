import type { Cronjob, CronjobExecution } from "@prisma/client";

export type RealtimeEventType =
  | "connected"
  | "cronjob.created"
  | "cronjob.updated"
  | "cronjob.enabled"
  | "cronjob.disabled"
  | "cronjob.deleted"
  | "cronjob.scheduled"
  | "execution.started"
  | "execution.succeeded"
  | "execution.failed"
  | "execution.retry_changed"
  | "cronjob.failure_count_changed"
  | "cronjob.final_stopped";

export interface RealtimeEvent {
  id: string;
  eventType: RealtimeEventType;
  emittedAt: string;
  cronjobId?: string;
  cronjobTitle?: string;
  executionId?: string;
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
  executionDetailUrl?: string;
  cronjob?: unknown;
  execution?: unknown;
}

export function createCronjobEvent(
  eventType: RealtimeEventType,
  cronjob: Cronjob,
  extra: Partial<RealtimeEvent> = {},
): Omit<RealtimeEvent, "id" | "emittedAt"> {
  return {
    eventType,
    cronjobId: cronjob.id,
    cronjobTitle: cronjob.title,
    status: cronjob.currentStatus,
    consecutiveFailures: cronjob.consecutiveFailures,
    nextExecutionAt: cronjob.nextExecutionAt?.toISOString() ?? null,
    ...extra,
  };
}

export function createExecutionEvent(
  eventType: RealtimeEventType,
  cronjob: Cronjob,
  execution: CronjobExecution,
  extra: Partial<RealtimeEvent> = {},
): Omit<RealtimeEvent, "id" | "emittedAt"> {
  return {
    eventType,
    cronjobId: cronjob.id,
    cronjobTitle: cronjob.title,
    executionId: execution.id,
    status: cronjob.currentStatus,
    success: execution.success,
    statusCode: execution.statusCode,
    statusText: execution.statusText,
    durationMs: execution.durationMs,
    retryAttempt: execution.retryAttempt,
    consecutiveFailures: cronjob.consecutiveFailures,
    startedAt: execution.startedAt.toISOString(),
    completedAt: execution.completedAt.toISOString(),
    nextExecutionAt: cronjob.nextExecutionAt?.toISOString() ?? null,
    responsePreview: execution.responsePreview,
    executionDetailUrl: `/api/executions/${execution.id}`,
    ...extra,
  };
}
