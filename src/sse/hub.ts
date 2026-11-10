import type { ServerResponse } from "node:http";

export interface OrderStreamEvent {
  status: string;
  etaMinutes: number | null;
  updatedAt: number;
  orderNumber: string;
}

type Client = {
  res: ServerResponse;
  heartbeat: NodeJS.Timeout;
};

function writeEvent(res: ServerResponse, event: string, data: string): void {
  res.write(`event: ${event}\ndata: ${data}\n\n`);
}

export class SseHub {
  private readonly clients = new Map<string, Set<Client>>();

  subscribe(orderId: string, res: ServerResponse): void {
    const heartbeat = setInterval(() => {
      writeEvent(res, "heartbeat", JSON.stringify({ t: Date.now() }));
    }, 25_000);

    const client: Client = { res, heartbeat };
    let set = this.clients.get(orderId);
    if (!set) {
      set = new Set();
      this.clients.set(orderId, set);
    }
    set.add(client);

    res.on("close", () => {
      clearInterval(heartbeat);
      set?.delete(client);
      if (set?.size === 0) this.clients.delete(orderId);
    });
  }

  broadcast(orderId: string, payload: OrderStreamEvent): void {
    const set = this.clients.get(orderId);
    if (!set) return;
    const data = JSON.stringify(payload);
    for (const client of set) {
      try {
        writeEvent(client.res, "status", data);
      } catch {
        /* client gone */
      }
    }
  }

  closeAll(): void {
    for (const set of this.clients.values()) {
      for (const client of set) {
        clearInterval(client.heartbeat);
      }
    }
    this.clients.clear();
  }
}
