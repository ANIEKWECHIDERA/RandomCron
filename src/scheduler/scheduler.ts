import type { Cronjob, PrismaClient } from "@prisma/client";
import type { AppConfig } from "../config/index.js";
import type { Logger } from "../logger/index.js";
import { calculateBackoffDelayMs } from "../utils/backoff.js";
import { randomIntervalMs } from "../utils/random.js";
import { CronjobExecutor } from "./executor.js";

interface ScheduledTask {
  timer?: NodeJS.Timeout;
  running: boolean;
}

export class MultiCronScheduler {
  private readonly tasks = new Map<string, ScheduledTask>();
  private readonly executor: CronjobExecutor;
  private stopping = false;

  constructor(
    private readonly prisma: PrismaClient,
    config: AppConfig,
    private readonly logger: Logger,
  ) {
    this.executor = new CronjobExecutor(prisma, config, logger);
  }

  async start(): Promise<void> {
    this.stopping = false;
    const enabledCronjobs = await this.prisma.cronjob.findMany({ where: { enabled: true } });
    for (const cronjob of enabledCronjobs) {
      this.schedule(cronjob, 0);
    }
    this.logger.info({ count: enabledCronjobs.length }, "Multi-cron scheduler started.");
  }

  async enable(cronjobId: string): Promise<Cronjob> {
    const cronjob = await this.prisma.cronjob.update({
      where: { id: cronjobId },
      data: { enabled: true, currentStatus: "scheduled" },
    });
    this.schedule(cronjob, 0);
    return cronjob;
  }

  async disable(cronjobId: string): Promise<Cronjob> {
    this.cancel(cronjobId);
    return this.prisma.cronjob.update({
      where: { id: cronjobId },
      data: { enabled: false, currentStatus: "disabled", nextExecutionAt: null },
    });
  }

  async remove(cronjobId: string): Promise<void> {
    this.cancel(cronjobId);
    await this.prisma.cronjob.delete({ where: { id: cronjobId } });
  }

  schedule(cronjob: Cronjob, overrideDelayMs?: number): void {
    if (this.stopping || !cronjob.enabled) {
      return;
    }

    const existing = this.tasks.get(cronjob.id);
    if (existing?.timer) {
      clearTimeout(existing.timer);
    }

    const delayMs = overrideDelayMs ?? getNextDelayMs(cronjob);
    const nextExecutionAt = new Date(Date.now() + delayMs);
    const task: ScheduledTask = existing ?? { running: false };

    task.timer = setTimeout(() => {
      void this.runOnce(cronjob.id);
    }, delayMs);

    this.tasks.set(cronjob.id, task);
    void this.prisma.cronjob
      .update({
        where: { id: cronjob.id },
        data: { currentStatus: "scheduled", nextExecutionAt },
      })
      .catch((error) => this.logger.error({ error, cronjobId: cronjob.id }, "Failed to persist next execution time."));
  }

  async runOnce(cronjobId: string): Promise<void> {
    if (this.stopping) {
      return;
    }

    const task = this.tasks.get(cronjobId) ?? { running: false };
    if (task.running) {
      this.logger.warn({ cronjobId }, "Skipped duplicate overlapping cronjob run.");
      return;
    }

    task.running = true;
    delete task.timer;
    this.tasks.set(cronjobId, task);

    try {
      const cronjob = await this.prisma.cronjob.findUnique({ where: { id: cronjobId } });
      if (!cronjob?.enabled) {
        this.cancel(cronjobId);
        return;
      }

      await this.prisma.cronjob.update({
        where: { id: cronjobId },
        data: { currentStatus: "running", nextExecutionAt: null },
      });

      const outcome = await this.executor.execute(cronjob);
      const latest = await this.prisma.cronjob.findUnique({ where: { id: cronjobId } });
      if (latest?.enabled && outcome.shouldContinue) {
        this.schedule({ ...latest, consecutiveFailures: outcome.consecutiveFailures });
      } else {
        this.cancel(cronjobId);
      }
    } finally {
      const latestTask = this.tasks.get(cronjobId);
      if (latestTask) {
        latestTask.running = false;
      }
    }
  }

  private cancel(cronjobId: string): void {
    const task = this.tasks.get(cronjobId);
    if (task?.timer) {
      clearTimeout(task.timer);
    }
    if (task?.running) {
      delete task.timer;
      this.tasks.set(cronjobId, task);
      return;
    }
    this.tasks.delete(cronjobId);
  }

  async shutdown(reason: string): Promise<void> {
    this.stopping = true;
    for (const [cronjobId, task] of this.tasks.entries()) {
      if (task.timer) {
        clearTimeout(task.timer);
      }
      await this.prisma.cronjob
        .update({ where: { id: cronjobId }, data: { nextExecutionAt: null } })
        .catch(() => undefined);
    }
    await this.waitForRunningTasks();
    this.tasks.clear();
    this.logger.info({ reason }, "Scheduler shut down.");
  }

  private async waitForRunningTasks(): Promise<void> {
    const startedAt = Date.now();
    while ([...this.tasks.values()].some((task) => task.running)) {
      if (Date.now() - startedAt > 10_000) {
        this.logger.warn("Timed out waiting for running cronjobs during shutdown.");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
}

function getNextDelayMs(cronjob: Cronjob): number {
  if (cronjob.consecutiveFailures > 0) {
    return calculateBackoffDelayMs({
      attempt: cronjob.consecutiveFailures,
      baseDelayMs: cronjob.minIntervalMs,
      maxDelayMs: cronjob.maxIntervalMs,
    });
  }

  return randomIntervalMs(cronjob.minIntervalMs, cronjob.maxIntervalMs);
}
