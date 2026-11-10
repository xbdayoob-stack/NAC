import type { FastifyInstance } from "fastify";
import type { Env } from "../config/env.js";

export async function registerAasaRoutes(
  app: FastifyInstance,
  env: Env,
): Promise<void> {
  app.get(
    "/.well-known/apple-app-site-association",
    { config: { raw: true } },
    async (_req, reply) => {
      const teamId = env.APPLE_TEAM_ID ?? "";
      const mainBundle = env.MAIN_BUNDLE_ID ?? "";
      const clipBundle = env.APP_CLIP_BUNDLE_ID ?? "";
      const clipAppId =
        teamId && clipBundle
          ? clipBundle.endsWith(".Clip")
            ? `${teamId}.${clipBundle}`
            : `${teamId}.${clipBundle}.Clip`
          : "";
      const mainAppId = teamId && mainBundle ? `${teamId}.${mainBundle}` : "";

      const body = {
        applinks: {
          apps: [],
          details: mainAppId
            ? [
                {
                  appID: mainAppId,
                  paths: ["/o/*", "/v1/orders/*"],
                },
              ]
            : [],
        },
        appclips: {
          apps: clipAppId ? [clipAppId] : [],
        },
      };

      return reply
        .type("application/json")
        .header("Content-Type", "application/json")
        .send(body);
    },
  );
}
