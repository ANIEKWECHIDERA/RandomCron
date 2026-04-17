import "dotenv/config";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/client.js";
import { ensureDatabase } from "../db/init.js";

process.env.DATABASE_URL ??= "file:./dev.db";

await ensureDatabase(prisma);

const cronjob = await prisma.cronjob.create({
  data: {
    title: `Persistence Smoke ${randomUUID().slice(0, 8)}`,
    url: "https://httpbin.org/json",
    method: "GET",
    enabled: false,
    headers: { Accept: "application/json" },
  },
});

const execution = await prisma.cronjobExecution.create({
  data: {
    cronjobId: cronjob.id,
    startedAt: new Date(),
    completedAt: new Date(),
    durationMs: 12,
    success: true,
    statusCode: 200,
    statusText: "OK",
    parsedResponseType: "json",
    responsePreview: "{\"ok\":true}",
  },
});

const loaded = await prisma.cronjob.findUnique({
  where: { id: cronjob.id },
  include: { executions: true },
});

if (!loaded || loaded.executions[0]?.id !== execution.id) {
  throw new Error("Persistence smoke test failed.");
}

await prisma.cronjob.delete({ where: { id: cronjob.id } });
await prisma.$disconnect();

console.log("Phase 1 persistence test passed.");
