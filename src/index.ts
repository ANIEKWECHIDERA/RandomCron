import { ConfigError, loadConfig } from "./config/index.js";
import { createApp } from "./api/app.js";
import { ensureDatabase } from "./db/init.js";
import { prisma } from "./db/client.js";
import { createLogger } from "./logger/index.js";
import { RealtimeHub } from "./realtime/hub.js";
import { MultiCronScheduler } from "./scheduler/scheduler.js";

try {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  process.env.DATABASE_URL = config.databaseUrl;

  logger.info(
    {
      port: config.port,
      databaseProvider: config.databaseProvider,
      databaseUrl: config.databaseUrl,
    },
    "Configuration loaded successfully.",
  );

  if (config.databaseProvider === "sqlite") {
    await ensureDatabase(prisma);
    logger.info("SQLite database is ready.");
  } else {
    logger.info("PostgreSQL mode enabled. Run npm run prisma:deploy before starting production.");
  }

  const realtime = new RealtimeHub(logger);
  const scheduler = new MultiCronScheduler(prisma, config, logger, realtime);
  await scheduler.start();

  const app = createApp(prisma, scheduler, config, logger, realtime);
  const server = app.listen(config.port, () => {
    logger.info({ port: config.port }, "RandomCron API started.");
  });

  const shutdown = async (reason: string) => {
    logger.info({ reason }, "Shutdown requested.");
    server.close();
    await scheduler.shutdown(reason);
    await prisma.$disconnect();
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    console.error(error);
    process.exitCode = 1;
  }
}
