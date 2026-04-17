import "dotenv/config";
import { once } from "node:events";
import { createServer } from "node:http";
import { AddressInfo } from "node:net";
import { createApp } from "../api/app.js";
import { loadConfig } from "../config/index.js";
import { prisma } from "../db/client.js";
import { ensureDatabase } from "../db/init.js";
import { createLogger } from "../logger/index.js";
import { MultiCronScheduler } from "../scheduler/scheduler.js";
import { sleep } from "../utils/sleep.js";

process.env.DATABASE_URL ??= "file:./dev.db";

const target = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ ok: true }));
});
target.listen(0, "127.0.0.1");
await once(target, "listening");
const targetPort = (target.address() as AddressInfo).port;

await ensureDatabase(prisma);
const logger = createLogger("silent");
const config = loadConfig();
const scheduler = new MultiCronScheduler(prisma, config, logger);
const app = createApp(prisma, scheduler, config, logger);
const api = createServer(app);
api.listen(0, "127.0.0.1");
await once(api, "listening");
const apiBase = `http://127.0.0.1:${(api.address() as AddressInfo).port}/api`;

const created = await request(`${apiBase}/cronjobs`, {
  method: "POST",
  body: JSON.stringify({
    title: "Phase 3 API",
    url: `http://127.0.0.1:${targetPort}/ok`,
    method: "GET",
    minIntervalMs: 1,
    maxIntervalMs: 2,
    enabled: true,
    headers: { Accept: "application/json" },
  }),
});

const cronjobId = created.data.id as string;
await sleep(120);

await request(`${apiBase}/cronjobs/${cronjobId}/disable`, { method: "POST" });
await request(`${apiBase}/cronjobs/${cronjobId}`, {
  method: "PATCH",
  body: JSON.stringify({ title: "Phase 3 API Edited" }),
});
const list = await request(`${apiBase}/cronjobs`);
const stats = await request(`${apiBase}/dashboard/stats`);
const charts = await request(`${apiBase}/dashboard/charts`);
const history = await request(`${apiBase}/cronjobs/${cronjobId}/executions?page=1&pageSize=5`);
await request(`${apiBase}/cronjobs/bulk/enable`, { method: "POST", body: JSON.stringify({ ids: [cronjobId] }) });
await request(`${apiBase}/cronjobs/bulk/disable`, { method: "POST", body: JSON.stringify({ ids: [cronjobId] }) });
await request(`${apiBase}/cronjobs/bulk/delete`, { method: "POST", body: JSON.stringify({ ids: [cronjobId] }), expectNoContent: true });

await scheduler.shutdown("phase 3 test complete");
api.close();
target.close();
await prisma.$disconnect();

if (!Array.isArray(list.data) || typeof stats.data.enabledCronjobs !== "number" || !charts.data.responseTimes) {
  throw new Error("Dashboard API responses were not shaped correctly.");
}

if (!Array.isArray(history.data) || history.data.length < 1) {
  throw new Error("Expected execution history to be recorded.");
}

console.log("Phase 3 API test passed.");

async function request(url: string, options: RequestInit & { expectNoContent?: boolean } = {}) {
  const response = await fetch(url, {
    headers: { "content-type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${url} failed with ${response.status}: ${await response.text()}`);
  }
  if (options.expectNoContent) {
    return null;
  }
  return response.json() as Promise<any>;
}
