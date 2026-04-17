import type { HttpRequestConfig } from "../http/client.js";
import type { AlertEmailService } from "../email/alerts.js";
import {
  isHttpRequestFailure,
  performHttpRequest,
  type HttpRequestResult,
  toErrorMessage,
} from "../http/client.js";
import type { Logger } from "../logger/index.js";
import { calculateBackoffDelayMs } from "../utils/backoff.js";
import { randomIntervalMs } from "../utils/random.js";
import { sleep } from "../utils/sleep.js";

export interface FailureDetails {
  timestamp: string;
  endpoint: string;
  method: string;
  attempt: number;
  maxRetries: number;
  errorSummary: string;
  responseStatus?: number;
  responseStatusText?: string;
  responseBody?: string;
}

export class MaxRetriesReachedError extends Error {
  constructor(public readonly details: FailureDetails) {
    super(`Maximum consecutive failures reached (${details.attempt}/${details.maxRetries}).`);
    this.name = "MaxRetriesReachedError";
  }
}

export class RandomCronWorker {
  private readonly abortController = new AbortController();
  private running = false;
  private consecutiveFailures = 0;

  constructor(
    private readonly config: HttpRequestConfig & {
      minIntervalMs: number;
      maxIntervalMs: number;
      maxRetries: number;
    },
    private readonly logger: Logger,
    private readonly alerts?: AlertEmailService,
  ) {}

  async start(): Promise<void> {
    this.running = true;
    this.logger.info("Random cron worker started.");

    while (this.running && !this.abortController.signal.aborted) {
      const delayMs = this.getNextDelayMs();
      this.logger.info(
        {
          delayMs,
          consecutiveFailures: this.consecutiveFailures,
          delayStrategy: this.consecutiveFailures > 0 ? "exponential_backoff_with_jitter" : "uniform_random",
        },
        "Waiting before next request.",
      );
      await sleep(delayMs, this.abortController.signal);

      try {
        const result = await performHttpRequest(this.config);
        this.consecutiveFailures = 0;
        this.alerts?.clearDedupGuard();
        this.logResponse(result);
      } catch (error) {
        this.consecutiveFailures += 1;
        const failureDetails = this.getFailureDetails(error);

        this.logger.error(
          {
            ...failureDetails,
            responseBody: failureDetails.responseBody,
          },
          "Request failed.",
        );

        await this.alerts?.sendFailureAlert(failureDetails);

        if (this.consecutiveFailures >= this.config.maxRetries) {
          this.logger.fatal(failureDetails, "Maximum consecutive failures reached. Worker is shutting down.");
          await this.alerts?.sendStoppingAlert(failureDetails);
          this.running = false;
          throw new MaxRetriesReachedError(failureDetails);
        }
      }
    }
  }

  stop(reason: string): void {
    if (!this.running) {
      return;
    }

    this.running = false;
    this.abortController.abort(new Error(reason));
    this.logger.info({ reason }, "Worker stop requested.");
  }

  private getNextDelayMs(): number {
    if (this.consecutiveFailures === 0) {
      return randomIntervalMs(this.config.minIntervalMs, this.config.maxIntervalMs);
    }

    return calculateBackoffDelayMs({
      attempt: this.consecutiveFailures,
      baseDelayMs: this.config.minIntervalMs,
      maxDelayMs: this.config.maxIntervalMs,
    });
  }

  private logResponse(result: HttpRequestResult): void {
    this.logger.info(
      {
        timestamp: result.timestamp,
        method: result.method,
        url: result.url,
        status: result.status,
        statusText: result.statusText,
        ok: result.ok,
        durationMs: result.durationMs,
        headers: summarizeHeaders(result.headers),
        bodyKind: result.bodyKind,
        bodyTruncated: result.bodyTruncated,
        body: result.bodyForLog,
      },
      "HTTP response received.",
    );
  }

  private getFailureDetails(error: unknown): FailureDetails {
    const result = isHttpRequestFailure(error) ? error.result : undefined;

    return {
      timestamp: new Date().toISOString(),
      endpoint: this.config.targetUrl,
      method: this.config.requestMethod,
      attempt: this.consecutiveFailures,
      maxRetries: this.config.maxRetries,
      errorSummary: toErrorMessage(error),
      ...(result
        ? {
            responseStatus: result.status,
            responseStatusText: result.statusText,
            responseBody: result.bodyForLog,
          }
        : {}),
    };
  }
}

function summarizeHeaders(headers: Record<string, string>): Record<string, string> {
  const usefulHeaders = [
    "content-type",
    "content-length",
    "cache-control",
    "etag",
    "date",
    "server",
    "x-request-id",
    "x-ratelimit-remaining",
  ];

  return Object.fromEntries(
    Object.entries(headers).filter(([header]) => usefulHeaders.includes(header.toLowerCase())),
  );
}
