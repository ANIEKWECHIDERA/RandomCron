import type { PrismaClient } from "@prisma/client";

export async function ensureDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Cronjob" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "title" TEXT NOT NULL,
      "url" TEXT NOT NULL,
      "method" TEXT NOT NULL DEFAULT 'GET',
      "headers" JSONB,
      "body" TEXT,
      "minIntervalMs" INTEGER NOT NULL DEFAULT 60000,
      "maxIntervalMs" INTEGER NOT NULL DEFAULT 840000,
      "timeoutMs" INTEGER NOT NULL DEFAULT 30000,
      "maxRetries" INTEGER NOT NULL DEFAULT 10,
      "enabled" BOOLEAN NOT NULL DEFAULT true,
      "currentStatus" TEXT NOT NULL DEFAULT 'idle',
      "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
      "lastExecutionAt" DATETIME,
      "nextExecutionAt" DATETIME,
      "lastSuccessAt" DATETIME,
      "lastFailureAt" DATETIME,
      "alertToEmail" TEXT,
      "alertFromEmail" TEXT,
      "allowNon2xx" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CronjobExecution" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "cronjobId" TEXT NOT NULL,
      "startedAt" DATETIME NOT NULL,
      "completedAt" DATETIME NOT NULL,
      "durationMs" INTEGER NOT NULL,
      "success" BOOLEAN NOT NULL,
      "statusCode" INTEGER,
      "statusText" TEXT,
      "requestHeaders" JSONB,
      "requestBody" TEXT,
      "responseHeaders" JSONB,
      "responseBody" TEXT,
      "responsePreview" TEXT,
      "parsedResponseType" TEXT NOT NULL,
      "errorMessage" TEXT,
      "retryAttempt" INTEGER NOT NULL DEFAULT 0,
      "alertSent" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CronjobExecution_cronjobId_fkey" FOREIGN KEY ("cronjobId") REFERENCES "Cronjob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cronjob_enabled_idx" ON "Cronjob"("enabled");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cronjob_currentStatus_idx" ON "Cronjob"("currentStatus");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cronjob_nextExecutionAt_idx" ON "Cronjob"("nextExecutionAt");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CronjobExecution_cronjobId_startedAt_idx" ON "CronjobExecution"("cronjobId", "startedAt");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CronjobExecution_success_idx" ON "CronjobExecution"("success");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CronjobExecution_createdAt_idx" ON "CronjobExecution"("createdAt");`);
}
