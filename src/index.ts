import { ConfigError, loadConfig } from "./config/index.js";
import { AlertEmailService } from "./email/alerts.js";
import { createLogger } from "./logger/index.js";
import { MaxRetriesReachedError, RandomCronWorker } from "./worker/worker.js";

try {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  const alerts = new AlertEmailService(config, logger);
  const worker = new RandomCronWorker(config, logger, alerts);

  process.once("SIGINT", () => worker.stop("SIGINT received."));
  process.once("SIGTERM", () => worker.stop("SIGTERM received."));

  logger.info(
    {
      targetUrl: config.targetUrl,
      requestMethod: config.requestMethod,
      minIntervalMs: config.minIntervalMs,
      maxIntervalMs: config.maxIntervalMs,
      maxRetries: config.maxRetries,
    },
    "Configuration loaded successfully.",
  );

  await worker.start();
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(error.message);
    process.exitCode = 1;
  } else if (error instanceof MaxRetriesReachedError) {
    process.exitCode = 1;
  } else if (error instanceof Error && error.message.includes("SIG")) {
    process.exitCode = 0;
  } else {
    console.error(error);
    process.exitCode = 1;
  }
}
