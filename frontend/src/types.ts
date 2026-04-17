export interface Cronjob {
  id: string;
  title: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  minIntervalMs: number;
  maxIntervalMs: number;
  timeoutMs: number;
  maxRetries: number;
  enabled: boolean;
  currentStatus: string;
  consecutiveFailures: number;
  lastExecutionAt: string | null;
  nextExecutionAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  alertToEmail: string | null;
  alertFromEmail: string | null;
  allowNon2xx: boolean;
  createdAt: string;
  updatedAt: string;
  totalRuns?: number;
  successCount?: number;
  failureCount?: number;
  averageResponseTimeMs?: number;
  latestExecution?: CronjobExecution | null;
}

export interface CronjobExecution {
  id: string;
  cronjobId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  success: boolean;
  statusCode: number | null;
  statusText: string | null;
  requestHeaders: Record<string, string>;
  requestBody: string | null;
  responseHeaders: Record<string, string> | null;
  responseBody: string | null;
  responsePreview: string | null;
  parsedResponseType: string;
  errorMessage: string | null;
  retryAttempt: number;
  alertSent: boolean;
  createdAt: string;
  cronjobTitle?: string;
  cronjobUrl?: string;
}

export interface DashboardStats {
  enabledCronjobs: number;
  disabledCronjobs: number;
  successfulCronjobs: number;
  failedCronjobs: number;
  averageResponseTimeMs: number;
}

export interface ChartData {
  responseTimes: Array<{
    timestamp: string;
    label: string;
    durationMs: number;
    cronjobId?: string;
    cronjobTitle: string;
    cronjobEnabled?: boolean;
  }>;
  successFailure: Array<{
    timestamp: string;
    label: string;
    success: number;
    failure: number;
  }>;
}

export interface CronjobFormValues {
  title: string;
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
  headersText: string;
  body: string;
  minIntervalMs: number;
  maxIntervalMs: number;
  timeoutMs: number;
  maxRetries: number;
  enabled: boolean;
  allowNon2xx: boolean;
  alertToEmail: string;
  alertFromEmail: string;
}
