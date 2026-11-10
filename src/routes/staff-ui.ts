import { readFileSync } from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";

let cachedHtml: string | undefined;

function staffHtml(): string {
  if (!cachedHtml) {
    cachedHtml = readFileSync(
      path.join(process.cwd(), "public/staff/index.html"),
      "utf8",
    );
  }
  return cachedHtml;
}

export async function registerStaffUiRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get("/staff", async (_req, reply) => {
    return reply.type("text/html").send(staffHtml());
  });
  app.get("/staff/", async (_req, reply) => {
    return reply.type("text/html").send(staffHtml());
  });
}
