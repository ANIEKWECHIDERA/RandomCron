import { Router } from "express";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { MultiCronScheduler } from "../scheduler/scheduler.js";
import { createCronjobEvent } from "../realtime/events.js";
import type { RealtimeHub } from "../realtime/hub.js";
import { bulkIdsSchema, cronjobInputSchema, cronjobUpdateSchema, paginationSchema } from "./schemas.js";
import { serializeCronjob, serializeExecution } from "./serializers.js";

export function createApiRouter(prisma: PrismaClient, scheduler: MultiCronScheduler, realtime: RealtimeHub): Router {
  const router = Router();

  router.get("/health", (_request, response) => {
    response.json({ ok: true, timestamp: new Date().toISOString() });
  });

  router.get("/cronjobs", async (request, response, next) => {
    try {
      const search = typeof request.query.search === "string" ? request.query.search.trim() : "";
      const where: Prisma.CronjobWhereInput = search
        ? {
            OR: [
              { title: { contains: search } },
              { url: { contains: search } },
              { currentStatus: { contains: search } },
            ],
          }
        : {};
      const cronjobs = await prisma.cronjob.findMany({ where, orderBy: { createdAt: "desc" } });
      response.json({ data: cronjobs.map(serializeCronjob) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/cronjobs", async (request, response, next) => {
    try {
      const input = cronjobInputSchema.parse(request.body);
      const cronjob = await prisma.cronjob.create({
        data: normalizeCronjobInput(input) as Prisma.CronjobUncheckedCreateInput,
      });
      realtime.broadcast(createCronjobEvent("cronjob.created", cronjob, { cronjob: serializeCronjob(cronjob) }));
      if (cronjob.enabled) {
        scheduler.schedule(cronjob, 0);
      }
      response.status(201).json({ data: serializeCronjob(cronjob) });
    } catch (error) {
      handleRouteError(error, response, next);
    }
  });

  router.post("/cronjobs/bulk/enable", async (request, response, next) => {
    try {
      const { ids } = bulkIdsSchema.parse(request.body);
      const results = [];
      for (const id of ids) {
        results.push(await scheduler.enable(id));
      }
      response.json({ data: results.map(serializeCronjob) });
    } catch (error) {
      handleRouteError(error, response, next);
    }
  });

  router.post("/cronjobs/bulk/disable", async (request, response, next) => {
    try {
      const { ids } = bulkIdsSchema.parse(request.body);
      const results = [];
      for (const id of ids) {
        results.push(await scheduler.disable(id));
      }
      response.json({ data: results.map(serializeCronjob) });
    } catch (error) {
      handleRouteError(error, response, next);
    }
  });

  router.post("/cronjobs/bulk/delete", async (request, response, next) => {
    try {
      const { ids } = bulkIdsSchema.parse(request.body);
      for (const id of ids) {
        await scheduler.remove(id);
        realtime.broadcast({
          eventType: "cronjob.deleted",
          cronjobId: id,
        });
      }
      response.status(204).send();
    } catch (error) {
      handleRouteError(error, response, next);
    }
  });

  router.get("/cronjobs/:id", async (request, response, next) => {
    try {
      const cronjob = await prisma.cronjob.findUnique({ where: { id: request.params.id } });
      if (!cronjob) {
        response.status(404).json({ error: "Cronjob not found." });
        return;
      }

      const [totalRuns, successCount, failureCount, averageResponse] = await Promise.all([
        prisma.cronjobExecution.count({ where: { cronjobId: cronjob.id } }),
        prisma.cronjobExecution.count({ where: { cronjobId: cronjob.id, success: true } }),
        prisma.cronjobExecution.count({ where: { cronjobId: cronjob.id, success: false } }),
        prisma.cronjobExecution.aggregate({ where: { cronjobId: cronjob.id }, _avg: { durationMs: true } }),
      ]);
      const latestExecution = await prisma.cronjobExecution.findFirst({
        where: { cronjobId: cronjob.id },
        orderBy: { startedAt: "desc" },
      });

      response.json({
        data: {
          ...serializeCronjob(cronjob),
          totalRuns,
          successCount,
          failureCount,
          averageResponseTimeMs: Math.round(averageResponse._avg.durationMs ?? 0),
          latestExecution: latestExecution ? serializeExecution(latestExecution) : null,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/cronjobs/:id", async (request, response, next) => {
    try {
      const input = cronjobUpdateSchema.parse(request.body);
      const cronjob = await prisma.cronjob.update({
        where: { id: request.params.id },
        data: normalizeCronjobInput(input) as Prisma.CronjobUncheckedUpdateInput,
      });
      realtime.broadcast(createCronjobEvent("cronjob.updated", cronjob, { cronjob: serializeCronjob(cronjob) }));
      if (cronjob.enabled) {
        scheduler.schedule(cronjob);
      } else {
        await scheduler.disable(cronjob.id);
      }
      response.json({ data: serializeCronjob(cronjob) });
    } catch (error) {
      handleRouteError(error, response, next);
    }
  });

  router.post("/cronjobs/:id/enable", async (request, response, next) => {
    try {
      const cronjob = await scheduler.enable(request.params.id);
      response.json({ data: serializeCronjob(cronjob) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/cronjobs/:id/disable", async (request, response, next) => {
    try {
      const cronjob = await scheduler.disable(request.params.id);
      response.json({ data: serializeCronjob(cronjob) });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/cronjobs/:id", async (request, response, next) => {
    try {
      await scheduler.remove(request.params.id);
      realtime.broadcast({
        eventType: "cronjob.deleted",
        cronjobId: request.params.id,
      });
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.get("/cronjobs/:id/executions", async (request, response, next) => {
    try {
      const { page, pageSize } = paginationSchema.parse(request.query);
      const where = { cronjobId: request.params.id };
      const [total, executions] = await Promise.all([
        prisma.cronjobExecution.count({ where }),
        prisma.cronjobExecution.findMany({
          where,
          orderBy: { startedAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);
      response.json({ data: executions.map(serializeExecution), meta: { page, pageSize, total } });
    } catch (error) {
      handleRouteError(error, response, next);
    }
  });

  router.get("/executions/:id", async (request, response, next) => {
    try {
      const execution = await prisma.cronjobExecution.findUnique({ where: { id: request.params.id } });
      if (!execution) {
        response.status(404).json({ error: "Execution not found." });
        return;
      }
      response.json({ data: serializeExecution(execution) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/dashboard/stats", async (_request, response, next) => {
    try {
      const [enabledCronjobs, disabledCronjobs, successfulCronjobs, failedCronjobs, avg] = await Promise.all([
        prisma.cronjob.count({ where: { enabled: true } }),
        prisma.cronjob.count({ where: { enabled: false } }),
        prisma.cronjob.count({ where: { currentStatus: "success" } }),
        prisma.cronjob.count({ where: { currentStatus: { in: ["failed", "stopped"] } } }),
        prisma.cronjobExecution.aggregate({ _avg: { durationMs: true } }),
      ]);
      response.json({
        data: {
          enabledCronjobs,
          disabledCronjobs,
          successfulCronjobs,
          failedCronjobs,
          averageResponseTimeMs: Math.round(avg._avg.durationMs ?? 0),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/dashboard/recent-events", async (_request, response, next) => {
    try {
      const executions = await prisma.cronjobExecution.findMany({
        orderBy: { startedAt: "desc" },
        take: 12,
        include: { cronjob: true },
      });
      response.json({
        data: executions.map((execution) => ({
          ...serializeExecution(execution),
          cronjobTitle: execution.cronjob.title,
          cronjobUrl: execution.cronjob.url,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/dashboard/failure-streaks", async (_request, response, next) => {
    try {
      const cronjobs = await prisma.cronjob.findMany({
        where: { consecutiveFailures: { gt: 0 } },
        orderBy: [{ consecutiveFailures: "desc" }, { updatedAt: "desc" }],
        take: 10,
      });
      response.json({ data: cronjobs.map(serializeCronjob) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/dashboard/charts", async (request, response, next) => {
    try {
      const cronjobId = typeof request.query.cronjobId === "string" ? request.query.cronjobId : undefined;
      const where = cronjobId ? { cronjobId } : {};
      const executions = await prisma.cronjobExecution.findMany({
        where,
        orderBy: { startedAt: "asc" },
        take: 100,
        include: { cronjob: true },
      });
      response.json({
        data: {
          responseTimes: executions.map((execution) => ({
            timestamp: execution.startedAt,
            label: execution.startedAt.toISOString().slice(11, 19),
            durationMs: execution.durationMs,
            cronjobTitle: execution.cronjob.title,
          })),
          successFailure: executions.map((execution) => ({
            timestamp: execution.startedAt,
            label: execution.startedAt.toISOString().slice(11, 19),
            success: execution.success ? 1 : 0,
            failure: execution.success ? 0 : 1,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function normalizeCronjobInput(input: Record<string, unknown>): Prisma.CronjobUncheckedCreateInput | Prisma.CronjobUncheckedUpdateInput {
  return {
    ...input,
    body: typeof input.body === "string" && input.body.trim() ? input.body : null,
    alertToEmail: typeof input.alertToEmail === "string" && input.alertToEmail.trim() ? input.alertToEmail : null,
    alertFromEmail:
      typeof input.alertFromEmail === "string" && input.alertFromEmail.trim() ? input.alertFromEmail : null,
  };
}

function handleRouteError(error: unknown, response: { status: (code: number) => { json: (body: unknown) => void } }, next: (error: unknown) => void) {
  if (error && typeof error === "object" && "issues" in error) {
    response.status(400).json({ error: "Validation failed.", issues: error.issues });
    return;
  }
  next(error);
}
