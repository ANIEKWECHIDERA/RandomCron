import "dotenv/config";

export const FOURTEEN_MINUTES_MS = 14 * 60 * 1000;

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export interface AppConfig {
  databaseUrl: string;
  port: number;
  clientOrigin: string;
  resendApiKey?: string;
  alertToEmail?: string;
  alertFromEmail?: string;
  logLevel: string;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_MIN_INTERVAL_MS = 60_000;
const DEFAULT_MAX_INTERVAL_MS = FOURTEEN_MINUTES_MS;
const DEFAULT_MAX_RETRIES = 10;
const DEFAULT_LOG_LEVEL = "info";

const SUPPORTED_METHODS = new Set<HttpMethod>([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

export class ConfigError extends Error {
  constructor(public readonly errors: string[]) {
    super(`Invalid configuration:\n${errors.map((error) => `- ${error}`).join("\n")}`);
    this.name = "ConfigError";
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const errors: string[] = [];

  const databaseUrl = emptyToUndefined(env.DATABASE_URL) ?? "file:./dev.db";
  const port = readPositiveInteger(env, "PORT", 3000, errors);
  const clientOrigin = emptyToUndefined(env.CLIENT_ORIGIN) ?? "http://localhost:5173";

  if (errors.length > 0) {
    throw new ConfigError(errors);
  }

  const resendApiKey = emptyToUndefined(env.RESEND_API_KEY);
  const alertToEmail = emptyToUndefined(env.ALERT_TO_EMAIL);
  const alertFromEmail = emptyToUndefined(env.ALERT_FROM_EMAIL);

  return {
    databaseUrl,
    port,
    clientOrigin,
    ...(resendApiKey ? { resendApiKey } : {}),
    ...(alertToEmail ? { alertToEmail } : {}),
    ...(alertFromEmail ? { alertFromEmail } : {}),
    logLevel: env.LOG_LEVEL || DEFAULT_LOG_LEVEL,
  };
}

function readRequiredString(env: NodeJS.ProcessEnv, name: string, errors: string[]): string | undefined {
  const value = emptyToUndefined(env[name]);
  if (!value) {
    errors.push(`${name} is required.`);
  }
  return value;
}

function readPositiveInteger(
  env: NodeJS.ProcessEnv,
  name: string,
  defaultValue: number,
  errors: string[],
): number {
  const rawValue = emptyToUndefined(env[name]);
  if (!rawValue) {
    return defaultValue;
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    errors.push(`${name} must be a positive integer.`);
    return defaultValue;
  }

  return value;
}

function readCustomHeaders(
  rawValue: string | undefined,
  errors: string[],
): Record<string, string> {
  const value = emptyToUndefined(rawValue);
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      errors.push("CUSTOM_HEADERS must be a JSON object.");
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([key, headerValue]) => {
        if (typeof headerValue !== "string") {
          errors.push(`CUSTOM_HEADERS.${key} must be a string value.`);
          return [key, String(headerValue)];
        }
        return [key, headerValue];
      }),
    );
  } catch {
    errors.push("CUSTOM_HEADERS must be valid JSON.");
    return {};
  }
}

function parseBoolean(rawValue: string | undefined, defaultValue: boolean): boolean {
  const value = emptyToUndefined(rawValue);
  if (!value) {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function hasHeader(headers: Record<string, string>, wantedHeader: string): boolean {
  return Object.keys(headers).some((header) => header.toLowerCase() === wantedHeader.toLowerCase());
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
