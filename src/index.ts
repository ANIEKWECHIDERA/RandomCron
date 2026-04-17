import { ConfigError, loadConfig } from "./config/index.js";
import { createApp } from "./api/app.js";
import { ensureDatabase } from "./db/init.js";
import { prisma } from "./db/client.js";
import { createLogger } from "./logger/index.js";
import { MultiCronScheduler } from "./scheduler/scheduler.js";

try {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  process.env.DATABASE_URL = config.databaseUrl;

  logger.info(
    {
      port: config.port,
      databaseUrl: config.databaseUrl,
    },
    "Configuration loaded successfully.",
  );

  await ensureDatabase(prisma);
  logger.info("Database is ready.");

  const scheduler = new MultiCronScheduler(prisma, config, logger);
  await scheduler.start();

  const app = createApp(prisma, scheduler, config, logger);
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
