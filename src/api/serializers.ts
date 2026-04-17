import type { Cronjob, CronjobExecution } from "@prisma/client";

const SECRET_HEADER_PATTERN = /authorization|api-key|token|secret|password/i;

export function serializeCronjob(cronjob: Cronjob) {
  return {
    ...cronjob,
    headers: maskHeaders(toRecord(cronjob.headers)),
  };
}

export function serializeExecution(execution: CronjobExecution) {
  return {
    ...execution,
    requestHeaders: maskHeaders(toRecord(execution.requestHeaders)),
  };
}

export function maskHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key, SECRET_HEADER_PATTERN.test(key) ? "********" : value]),
  );
}

export function toRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}
