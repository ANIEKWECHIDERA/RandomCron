import "dotenv/config";
import { once } from "node:events";
import { createServer } from "node:http";
import { AddressInfo } from "node:net";
import { createApp } from "../api/app.js";
import { loadConfig } from "../config/index.js";
import { prisma } from "../db/client.js";
import { ensureDatabase } from "../db/init.js";
import { createLogger } from "../logger/index.js";
import { RealtimeHub } from "../realtime/hub.js";
import type { RealtimeEvent } from "../realtime/events.js";
import { MultiCronScheduler } from "../scheduler/scheduler.js";
import { sleep } from "../utils/sleep.js";

process.env.DATABASE_URL ??= "file:./dev.db";

const target = createServer((_request, response) => {
  if (_request.url === "/fail") {
    response.writeHead(500, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: false, realtime: true }));
    return;
  }
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ ok: true, realtime: true }));
});
target.listen(0, "127.0.0.1");
await once(target, "listening");
const targetPort = (target.address() as AddressInfo).port;

await ensureDatabase(prisma);
const logger = createLogger("silent");
const realtime = new RealtimeHub(logger);
const { resendApiKey, alertFromEmail, alertToEmail, ...config } = loadConfig();
const scheduler = new MultiCronScheduler(prisma, config, logger, realtime);
const app = createApp(prisma, scheduler, config, logger, realtime);
const api = createServer(app);
api.listen(0, "127.0.0.1");
await once(api, "listening");
const apiBase = `http://127.0.0.1:${(api.address() as AddressInfo).port}/api`;

const events: RealtimeEvent[] = [];
const eventStream = await fetch(`${apiBase}/realtime/events`);
if (!eventStream.body) {
  throw new Error("Realtime response did not include a stream.");
}

const reader = eventStream.body.getReader();
const decoder = new TextDecoder();
let buffer = "";
let stopReading = false;
const readLoop = (async () => {
  while (!stopReading) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const dataLine = chunk.split("\n").find((line) => line.startsWith("data: "));
      if (dataLine) {
        events.push(JSON.parse(dataLine.slice(6)) as RealtimeEvent);
      }
    }
  }
})();

const created = await request(`${apiBase}/cronjobs`, {
  method: "POST",
  body: JSON.stringify({
    title: "Realtime Phase Test",
    url: `http://127.0.0.1:${targetPort}/ok`,
    method: "GET",
    headers: { Accept: "application/json" },
    minIntervalMs: 50,
    maxIntervalMs: 100,
    timeoutMs: 5000,
    maxRetries: 3,
    enabled: true,
  }),
});
const cronjobId = created.data.id as string;

await waitForEvent(events, "execution.succeeded", cronjobId);
await request(`${apiBase}/cronjobs/${cronjobId}`, { method: "DELETE", expectNoContent: true });

const failing = await request(`${apiBase}/cronjobs`, {
  method: "POST",
  body: JSON.stringify({
    title: "Realtime Failure Phase Test",
    url: `http://127.0.0.1:${targetPort}/fail`,
    method: "GET",
    headers: { Accept: "application/json" },
    minIntervalMs: 50,
    maxIntervalMs: 100,
    timeoutMs: 5000,
    maxRetries: 2,
    enabled: true,
  }),
});
const failingCronjobId = failing.data.id as string;
await waitForEvent(events, "execution.failed", failingCronjobId);
await waitForEvent(events, "cronjob.final_stopped", failingCronjobId);
await request(`${apiBase}/cronjobs/${failingCronjobId}`, { method: "DELETE", expectNoContent: true });

stopReading = true;
await reader.cancel().catch(() => undefined);
await readLoop.catch(() => undefined);
await scheduler.shutdown("phase 4 realtime test complete");
api.close();
target.close();
await prisma.$disconnect();

const seen = new Set(events.filter((event) => event.cronjobId === cronjobId).map((event) => event.eventType));
for (const expected of ["cronjob.created", "cronjob.scheduled", "execution.started", "execution.succeeded"]) {
  if (!seen.has(expected as RealtimeEvent["eventType"])) {
    throw new Error(`Missing realtime event: ${expected}. Saw ${Array.from(seen).join(", ")}`);
  }
}

const failureSeen = new Set(events.filter((event) => event.cronjobId === failingCronjobId).map((event) => event.eventType));
for (const expected of ["execution.failed", "execution.retry_changed", "cronjob.failure_count_changed", "cronjob.final_stopped"]) {
  if (!failureSeen.has(expected as RealtimeEvent["eventType"])) {
    throw new Error(`Missing failure realtime event: ${expected}. Saw ${Array.from(failureSeen).join(", ")}`);
  }
}

console.log("Phase 4.5 realtime test passed.");

async function waitForEvent(
  events: RealtimeEvent[],
  eventType: RealtimeEvent["eventType"],
  cronjobId: string,
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15_000) {
    if (events.some((event) => event.eventType === eventType && event.cronjobId === cronjobId)) {
      return;
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${eventType}`);
}

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
