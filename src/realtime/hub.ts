import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import type { Logger } from "../logger/index.js";
import type { RealtimeEvent } from "./events.js";

interface Client {
  id: string;
  response: Response;
}

export class RealtimeHub {
  private readonly clients = new Map<string, Client>();
  private eventCounter = 0;

  constructor(private readonly logger: Logger) {}

  router(): Router {
    const router = createRouter();
    router.get("/events", (request, response) => this.handleConnection(request, response));
    return router;
  }

  broadcast(event: Omit<RealtimeEvent, "id" | "emittedAt">): RealtimeEvent {
    const payload: RealtimeEvent = {
      id: `${Date.now()}-${++this.eventCounter}`,
      emittedAt: new Date().toISOString(),
      ...event,
    };

    for (const client of this.clients.values()) {
      this.write(client.response, payload);
    }

    this.logger.debug(
      {
        eventType: payload.eventType,
        cronjobId: payload.cronjobId,
        executionId: payload.executionId,
        clients: this.clients.size,
      },
      "Realtime event broadcast.",
    );

    return payload;
  }

  private handleConnection(request: Request, response: Response): void {
    const clientId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    response.write("retry: 2000\n\n");

    const client: Client = { id: clientId, response };
    this.clients.set(clientId, client);
    this.write(response, {
      id: `${Date.now()}-${++this.eventCounter}`,
      emittedAt: new Date().toISOString(),
      eventType: "connected",
    });

    request.on("close", () => {
      this.clients.delete(clientId);
      this.logger.debug({ clientId, clients: this.clients.size }, "Realtime client disconnected.");
    });
  }

  private write(response: Response, event: RealtimeEvent): void {
    response.write(`id: ${event.id}\n`);
    response.write(`event: ${event.eventType}\n`);
    response.write(`data: ${JSON.stringify(event)}\n\n`);
  }
}
