import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "@prisma/client";
import type { AppConfig } from "../config/index.js";
import type { Logger } from "../logger/index.js";
import type { MultiCronScheduler } from "../scheduler/scheduler.js";
import { createApiRouter } from "./routes.js";

export function createApp(
  prisma: PrismaClient,
  scheduler: MultiCronScheduler,
  config: AppConfig,
  logger: Logger,
) {
  const app = express();

  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", createApiRouter(prisma, scheduler));

  const staticDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");
  app.use(express.static(staticDir));
  app.get(/.*/, (_request, response) => {
    response.sendFile(path.join(staticDir, "index.html"), (error) => {
      if (error) {
        response.status(404).json({ error: "Frontend build not found. Run npm run build:web." });
      }
    });
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    logger.error({ error }, "Unhandled API error.");
    response.status(500).json({ error: "Internal server error." });
  });

  return app;
}
