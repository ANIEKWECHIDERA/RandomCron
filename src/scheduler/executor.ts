import { Prisma, type Cronjob, type PrismaClient } from "@prisma/client";
import type { AppConfig } from "../config/index.js";
import { AlertEmailService } from "../email/alerts.js";
import { isHttpRequestFailure, performHttpRequest, toErrorMessage } from "../http/client.js";
import type { Logger } from "../logger/index.js";
import { createExecutionEvent } from "../realtime/events.js";
import type { RealtimeHub } from "../realtime/hub.js";
import { truncateText } from "../utils/text.js";
import type { FailureDetails } from "../worker/worker.js";

export interface CronjobExecutionOutcome {
  success: boolean;
  consecutiveFailures: number;
  shouldContinue: boolean;
}

export class CronjobExecutor {
  private readonly alerts?: AlertEmailService;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: AppConfig,
    private readonly logger: Logger,
    private readonly realtime: RealtimeHub,
  ) {
    if (config.resendApiKey && config.alertFromEmail && config.alertToEmail) {
      this.alerts = new AlertEmailService(
        {
          resendApiKey: config.resendApiKey,
          alertFromEmail: config.alertFromEmail,
          alertToEmail: config.alertToEmail,
        },
        logger,
      );
    }
  }

  async execute(cronjob: Cronjob): Promise<CronjobExecutionOutcome> {
    const startedAt = new Date();
    const headers = parseHeaders(cronjob.headers);
    const requestConfig = {
      targetUrl: cronjob.url,
      requestMethod: cronjob.method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS",
      requestTimeoutMs: cronjob.timeoutMs,
      allowNon2xx: cronjob.allowNon2xx,
      customHeaders: headers,
      ...(cronjob.body ? { requestBody: cronjob.body } : {}),
    };

    try {
      const result = await performHttpRequest(requestConfig);
      const completedAt = new Date();

      const [execution, updatedCronjob] = await this.prisma.$transaction([
        this.prisma.cronjobExecution.create({
          data: {
            cronjobId: cronjob.id,
            startedAt,
            completedAt,
            durationMs: result.durationMs,
            success: true,
            statusCode: result.status,
            statusText: result.statusText,
            requestHeaders: headers,
            requestBody: cronjob.body,
            responseHeaders: result.headers,
            responseBody: result.body,
            responsePreview: truncateText(result.bodyForLog, 700).value,
            parsedResponseType: result.bodyKind,
            retryAttempt: cronjob.consecutiveFailures,
            alertSent: false,
          },
        }),
        this.prisma.cronjob.update({
          where: { id: cronjob.id },
          data: {
            currentStatus: "success",
            consecutiveFailures: 0,
            lastExecutionAt: completedAt,
            lastSuccessAt: completedAt,
          },
        }),
      ]);

      this.alerts?.clearDedupGuard();
      this.realtime.broadcast(
        createExecutionEvent("execution.succeeded", updatedCronjob, execution, {
          execution,
          cronjob: updatedCronjob,
        }),
      );
      this.logger.info({ cronjobId: cronjob.id, status: result.status, durationMs: result.durationMs }, "Cronjob execution succeeded.");

      return { success: true, consecutiveFailures: 0, shouldContinue: true };
    } catch (error) {
      const completedAt = new Date();
      const previousFailures = cronjob.consecutiveFailures;
      const consecutiveFailures = previousFailures + 1;
      const result = isHttpRequestFailure(error) ? error.result : undefined;
      const failureDetails: FailureDetails = {
        timestamp: completedAt.toISOString(),
        endpoint: cronjob.url,
        method: cronjob.method,
        attempt: consecutiveFailures,
        maxRetries: cronjob.maxRetries,
        errorSummary: toErrorMessage(error),
        ...(result
          ? {
              responseStatus: result.status,
              responseStatusText: result.statusText,
              responseBody: result.bodyForLog,
            }
          : {}),
      };

      let alertSent = false;
      if (this.alerts) {
        await this.alerts.sendFailureAlert(failureDetails);
        alertSent = true;
      }

      const shouldStop = consecutiveFailures >= cronjob.maxRetries;
      if (shouldStop && this.alerts) {
        await this.alerts.sendStoppingAlert(failureDetails);
      }

      const [execution, updatedCronjob] = await this.prisma.$transaction([
        this.prisma.cronjobExecution.create({
          data: {
            cronjobId: cronjob.id,
            startedAt,
            completedAt,
            durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
            success: false,
            statusCode: result?.status ?? null,
            statusText: result?.statusText ?? null,
            requestHeaders: headers,
            requestBody: cronjob.body ?? null,
            responseHeaders: result?.headers ?? Prisma.JsonNull,
            responseBody: result?.body ?? null,
            responsePreview: truncateText(result?.bodyForLog ?? "", 700).value,
            parsedResponseType: result?.bodyKind ?? "unreadable",
            errorMessage: toErrorMessage(error),
            retryAttempt: consecutiveFailures,
            alertSent,
          },
        }),
        this.prisma.cronjob.update({
          where: { id: cronjob.id },
          data: {
            currentStatus: shouldStop ? "stopped" : "failed",
            consecutiveFailures,
            enabled: shouldStop ? false : cronjob.enabled,
            lastExecutionAt: completedAt,
            lastFailureAt: completedAt,
            nextExecutionAt: shouldStop ? null : cronjob.nextExecutionAt,
          },
        }),
      ]);

      this.realtime.broadcast(
        createExecutionEvent("execution.failed", updatedCronjob, execution, {
          execution,
          cronjob: updatedCronjob,
        }),
      );
      this.realtime.broadcast({
        eventType: "execution.retry_changed",
        cronjobId: updatedCronjob.id,
        cronjobTitle: updatedCronjob.title,
        executionId: execution.id,
        status: updatedCronjob.currentStatus,
        retryAttempt: execution.retryAttempt,
        consecutiveFailures: updatedCronjob.consecutiveFailures,
      });
      this.realtime.broadcast({
        eventType: "cronjob.failure_count_changed",
        cronjobId: updatedCronjob.id,
        cronjobTitle: updatedCronjob.title,
        status: updatedCronjob.currentStatus,
        consecutiveFailures: updatedCronjob.consecutiveFailures,
      });
      if (shouldStop) {
        this.realtime.broadcast({
          eventType: "cronjob.final_stopped",
          cronjobId: updatedCronjob.id,
          cronjobTitle: updatedCronjob.title,
          executionId: execution.id,
          status: updatedCronjob.currentStatus,
          consecutiveFailures: updatedCronjob.consecutiveFailures,
          retryAttempt: execution.retryAttempt,
          completedAt: execution.completedAt.toISOString(),
        });
      }

      this.logger.error(
        {
          cronjobId: cronjob.id,
          consecutiveFailures,
          maxRetries: cronjob.maxRetries,
          error: toErrorMessage(error),
        },
        shouldStop ? "Cronjob stopped after maximum failures." : "Cronjob execution failed.",
      );

      return { success: false, consecutiveFailures, shouldContinue: !shouldStop };
    }
  }
}

function parseHeaders(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}
