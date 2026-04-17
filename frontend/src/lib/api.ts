import type { ChartData, Cronjob, CronjobExecution, CronjobFormValues, DashboardStats } from "@/types";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    headers: { "content-type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  cronjobs: () => request<{ data: Cronjob[] }>("/cronjobs"),
  cronjob: (id: string) => request<{ data: Cronjob }>(`/cronjobs/${id}`),
  createCronjob: (values: CronjobFormValues) =>
    request<{ data: Cronjob }>("/cronjobs", {
      method: "POST",
      body: JSON.stringify(formToPayload(values)),
    }),
  updateCronjob: (id: string, values: CronjobFormValues) =>
    request<{ data: Cronjob }>(`/cronjobs/${id}`, {
      method: "PATCH",
      body: JSON.stringify(formToPayload(values)),
    }),
  enableCronjob: (id: string) => request<{ data: Cronjob }>(`/cronjobs/${id}/enable`, { method: "POST" }),
  disableCronjob: (id: string) => request<{ data: Cronjob }>(`/cronjobs/${id}/disable`, { method: "POST" }),
  deleteCronjob: (id: string) => request<void>(`/cronjobs/${id}`, { method: "DELETE" }),
  bulkEnable: (ids: string[]) => request<{ data: Cronjob[] }>("/cronjobs/bulk/enable", { method: "POST", body: JSON.stringify({ ids }) }),
  bulkDisable: (ids: string[]) => request<{ data: Cronjob[] }>("/cronjobs/bulk/disable", { method: "POST", body: JSON.stringify({ ids }) }),
  bulkDelete: (ids: string[]) => request<void>("/cronjobs/bulk/delete", { method: "POST", body: JSON.stringify({ ids }) }),
  history: (id: string, page = 1, pageSize = 20) =>
    request<{ data: CronjobExecution[]; meta: { page: number; pageSize: number; total: number } }>(
      `/cronjobs/${id}/executions?page=${page}&pageSize=${pageSize}`,
    ),
  execution: (id: string) => request<{ data: CronjobExecution }>(`/executions/${id}`),
  stats: () => request<{ data: DashboardStats }>("/dashboard/stats"),
  charts: (cronjobId?: string) => request<{ data: ChartData }>(`/dashboard/charts${cronjobId ? `?cronjobId=${cronjobId}` : ""}`),
  recentEvents: () => request<{ data: CronjobExecution[] }>("/dashboard/recent-events"),
  failureStreaks: () => request<{ data: Cronjob[] }>("/dashboard/failure-streaks"),
};

export function cronjobToForm(cronjob?: Cronjob): CronjobFormValues {
  return {
    title: cronjob?.title ?? "",
    url: cronjob?.url ?? "",
    method: (cronjob?.method as CronjobFormValues["method"] | undefined) ?? "GET",
    headersText: JSON.stringify(cronjob?.headers ?? { Accept: "application/json" }, null, 2),
    body: cronjob?.body ?? "",
    minIntervalMs: cronjob?.minIntervalMs ?? 60_000,
    maxIntervalMs: cronjob?.maxIntervalMs ?? 840_000,
    timeoutMs: cronjob?.timeoutMs ?? 30_000,
    maxRetries: cronjob?.maxRetries ?? 10,
    enabled: cronjob?.enabled ?? true,
    allowNon2xx: cronjob?.allowNon2xx ?? false,
    alertToEmail: cronjob?.alertToEmail ?? "",
    alertFromEmail: cronjob?.alertFromEmail ?? "",
  };
}

function formToPayload(values: CronjobFormValues) {
  return {
    title: values.title,
    url: values.url,
    method: values.method,
    headers: JSON.parse(values.headersText || "{}") as Record<string, string>,
    body: values.body || null,
    minIntervalMs: Number(values.minIntervalMs),
    maxIntervalMs: Number(values.maxIntervalMs),
    timeoutMs: Number(values.timeoutMs),
    maxRetries: Number(values.maxRetries),
    enabled: values.enabled,
    allowNon2xx: values.allowNon2xx,
    alertToEmail: values.alertToEmail || null,
    alertFromEmail: values.alertFromEmail || null,
  };
}
