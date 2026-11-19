import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/database.js";

const start = async () => {
  await prisma.$connect();
  const server = app.listen(env.PORT, "0.0.0.0", () => {
    console.info(`SpecForge API listening on port ${env.PORT}`);
  });

  const shutdown = (signal: string) => {
    console.info(`${signal} received; closing server`);
    server.close(async (error) => {
      await prisma.$disconnect();
      if (error) {
        console.error("Failed to close server cleanly", error);
        process.exitCode = 1;
      }
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
};

start().catch((error: unknown) => {
  console.error("Failed to start SpecForge API", error);
  process.exitCode = 1;
});
