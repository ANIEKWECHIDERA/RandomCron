import "dotenv/config";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { loadConfig } from "../config/index.js";
import { prisma } from "../db/client.js";
import { ensureDatabase } from "../db/init.js";
import { createLogger } from "../logger/index.js";
import { MultiCronScheduler } from "../scheduler/scheduler.js";
import { sleep } from "../utils/sleep.js";

process.env.DATABASE_URL ??= "file:./dev.db";

let slowRunning = 0;
let maxSlowConcurrency = 0;

const server = createServer((request, response) => {
  if (request.url === "/slow") {
    slowRunning += 1;
    maxSlowConcurrency = Math.max(maxSlowConcurrency, slowRunning);
    setTimeout(() => {
      slowRunning -= 1;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true, slow: true }));
    }, 80);
    return;
  }

  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ ok: true, path: request.url }));
});

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") {
  throw new Error("Unable to start phase 2 test server.");
}

await ensureDatabase(prisma);
const logger = createLogger("silent");
const config = loadConfig();
const scheduler = new MultiCronScheduler(prisma, config, logger);
const testKey = randomUUID();

const fast = await prisma.cronjob.create({
  data: {
    title: `Phase2 Fast ${testKey}`,
    url: `http://127.0.0.1:${address.port}/fast`,
    method: "GET",
    enabled: true,
    minIntervalMs: 1,
    maxIntervalMs: 2,
  },
});

const slow = await prisma.cronjob.create({
  data: {
    title: `Phase2 Slow ${testKey}`,
    url: `http://127.0.0.1:${address.port}/slow`,
    method: "GET",
    enabled: true,
    minIntervalMs: 1,
    maxIntervalMs: 2,
  },
});

await scheduler.start();
await sleep(350);
await scheduler.disable(fast.id);
await scheduler.disable(slow.id);
await scheduler.shutdown("phase 2 test complete");

const fastRuns = await prisma.cronjobExecution.count({ where: { cronjobId: fast.id } });
const slowRuns = await prisma.cronjobExecution.count({ where: { cronjobId: slow.id } });

await prisma.cronjob.deleteMany({ where: { id: { in: [fast.id, slow.id] } } });
await prisma.$disconnect();
server.close();

if (fastRuns < 1 || slowRuns < 1) {
  throw new Error(`Expected executions for both jobs. fast=${fastRuns}, slow=${slowRuns}`);
}

if (maxSlowConcurrency > 1) {
  throw new Error(`Expected no overlapping runs for one job, saw concurrency ${maxSlowConcurrency}.`);
}

console.log("Phase 2 scheduler test passed.");
