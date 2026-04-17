CREATE TABLE "Cronjob" (
    "id" TEXT NOT NULL,
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
    "lastExecutionAt" TIMESTAMP(3),
    "nextExecutionAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "alertToEmail" TEXT,
    "alertFromEmail" TEXT,
    "allowNon2xx" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cronjob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CronjobExecution" (
    "id" TEXT NOT NULL,
    "cronjobId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CronjobExecution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Cronjob_enabled_idx" ON "Cronjob"("enabled");
CREATE INDEX "Cronjob_currentStatus_idx" ON "Cronjob"("currentStatus");
CREATE INDEX "Cronjob_nextExecutionAt_idx" ON "Cronjob"("nextExecutionAt");
CREATE INDEX "CronjobExecution_cronjobId_startedAt_idx" ON "CronjobExecution"("cronjobId", "startedAt");
CREATE INDEX "CronjobExecution_success_idx" ON "CronjobExecution"("success");
CREATE INDEX "CronjobExecution_createdAt_idx" ON "CronjobExecution"("createdAt");

ALTER TABLE "CronjobExecution"
ADD CONSTRAINT "CronjobExecution_cronjobId_fkey"
FOREIGN KEY ("cronjobId") REFERENCES "Cronjob"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
