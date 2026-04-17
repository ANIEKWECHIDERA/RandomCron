import { Resend } from "resend";
import type { Logger } from "../logger/index.js";
import { truncateText } from "../utils/text.js";
import type { FailureDetails } from "../worker/worker.js";

export interface AlertEmailConfig {
  resendApiKey: string;
  alertToEmail: string;
  alertFromEmail: string;
}

export class AlertEmailService {
  private readonly resend: Resend;
  private readonly sentEventKeys = new Set<string>();

  constructor(
    private readonly config: AlertEmailConfig,
    private readonly logger: Logger,
  ) {
    this.resend = new Resend(config.resendApiKey);
  }

  async sendFailureAlert(details: FailureDetails): Promise<void> {
    const eventKey = getFailureEventKey(details, "failure");
    if (this.sentEventKeys.has(eventKey)) {
      this.logger.warn({ eventKey, attempt: details.attempt }, "Duplicate failure alert suppressed.");
      return;
    }

    this.sentEventKeys.add(eventKey);
    await this.sendAlert({
      subject: `[RandomCron] ${details.endpoint} failure attempt ${details.attempt}/${details.maxRetries}`,
      title: "Random cron request failed",
      details,
    });
  }

  async sendStoppingAlert(details: FailureDetails): Promise<void> {
    const eventKey = getFailureEventKey(details, "stopping");
    if (this.sentEventKeys.has(eventKey)) {
      this.logger.warn({ eventKey, attempt: details.attempt }, "Duplicate stopping alert suppressed.");
      return;
    }

    this.sentEventKeys.add(eventKey);
    await this.sendAlert({
      subject: `[RandomCron] STOPPED ${details.endpoint} after ${details.attempt} failures`,
      title: "Random cron worker stopped",
      details,
      lead: "Maximum consecutive failures were reached. The worker has stopped.",
    });
  }

  clearDedupGuard(): void {
    this.sentEventKeys.clear();
  }

  private async sendAlert(input: {
    subject: string;
    title: string;
    details: FailureDetails;
    lead?: string;
  }): Promise<void> {
    const text = buildTextEmail(input);
    const html = buildHtmlEmail(input);

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.config.alertFromEmail,
        to: [this.config.alertToEmail],
        subject: input.subject,
        text,
        html,
      });

      if (error) {
        this.logger.error(
          {
            errorName: error.name,
            errorMessage: error.message,
            statusCode: "statusCode" in error ? error.statusCode : undefined,
          },
          "Failed to send Resend alert.",
        );
        return;
      }

      this.logger.info({ emailId: data?.id, subject: input.subject }, "Resend alert sent.");
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "Resend alert request failed.",
      );
    }
  }
}

function buildTextEmail(input: {
  title: string;
  details: FailureDetails;
  lead?: string;
}): string {
  const body = truncateText(input.details.responseBody ?? "", 8_000);

  return [
    input.title,
    input.lead ?? "",
    `Timestamp: ${input.details.timestamp}`,
    `Endpoint: ${input.details.endpoint}`,
    `Method: ${input.details.method}`,
    `Attempt: ${input.details.attempt}/${input.details.maxRetries}`,
    `Error: ${input.details.errorSummary}`,
    `Response status: ${input.details.responseStatus ?? "n/a"} ${input.details.responseStatusText ?? ""}`.trim(),
    "",
    "Response body:",
    body.value || "(empty)",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildHtmlEmail(input: {
  title: string;
  details: FailureDetails;
  lead?: string;
}): string {
  const body = truncateText(input.details.responseBody ?? "", 8_000);

  return `
    <h1>${escapeHtml(input.title)}</h1>
    ${input.lead ? `<p><strong>${escapeHtml(input.lead)}</strong></p>` : ""}
    <ul>
      <li><strong>Timestamp:</strong> ${escapeHtml(input.details.timestamp)}</li>
      <li><strong>Endpoint:</strong> ${escapeHtml(input.details.endpoint)}</li>
      <li><strong>Method:</strong> ${escapeHtml(input.details.method)}</li>
      <li><strong>Attempt:</strong> ${input.details.attempt}/${input.details.maxRetries}</li>
      <li><strong>Error:</strong> ${escapeHtml(input.details.errorSummary)}</li>
      <li><strong>Response status:</strong> ${input.details.responseStatus ?? "n/a"} ${escapeHtml(input.details.responseStatusText ?? "")}</li>
    </ul>
    <h2>Response body</h2>
    <pre style="white-space: pre-wrap; word-break: break-word;">${escapeHtml(body.value || "(empty)")}</pre>
  `;
}

function getFailureEventKey(details: FailureDetails, kind: "failure" | "stopping"): string {
  return [
    kind,
    details.timestamp,
    details.endpoint,
    details.method,
    details.attempt,
    details.errorSummary,
    details.responseStatus ?? "",
  ].join("|");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
