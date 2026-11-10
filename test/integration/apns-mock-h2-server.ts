import http2 from "node:http2";
import type { AddressInfo } from "node:net";

export interface MockApnsServer {
  port: number;
  close: () => void;
  setNextStatus: (code: number, reason?: string) => void;
  calls: { path: string; headers: http2.IncomingHttpHeaders }[];
}

export function startMockApnsServer(): Promise<MockApnsServer> {
  let nextStatus = 200;
  let nextReason: string | undefined;
  const calls: MockApnsServer["calls"] = [];

  const server = http2.createServer();

  server.on("stream", (stream, headers) => {
    calls.push({ path: headers[":path"] ?? "", headers });
    stream.respond({
      ":status": nextStatus,
      "content-type": "application/json",
    });
    if (nextReason) {
      stream.end(JSON.stringify({ reason: nextReason }));
    } else {
      stream.end();
    }
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as AddressInfo).port;
      resolve({
        port,
        calls,
        close: () => server.close(),
        setNextStatus(code: number, reason?: string) {
          nextStatus = code;
          nextReason = reason;
        },
      });
    });
  });
}
