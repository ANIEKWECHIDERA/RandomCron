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
  targetUrl: string;
  requestMethod: HttpMethod;
  requestTimeoutMs: number;
  minIntervalMs: number;
  maxIntervalMs: number;
  maxRetries: number;
  allowNon2xx: boolean;
  resendApiKey: string;
  alertToEmail: string;
  alertFromEmail: string;
  authBearerToken?: string;
  customHeaders: Record<string, string>;
  requestBody?: string;
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

  const targetUrl = readRequiredString(env, "TARGET_URL", errors);
  if (targetUrl) {
    try {
      new URL(targetUrl);
    } catch {
      errors.push("TARGET_URL must be a valid URL.");
    }
  }

  const requestMethod = (env.REQUEST_METHOD || "GET").toUpperCase();
  if (!SUPPORTED_METHODS.has(requestMethod as HttpMethod)) {
    errors.push(`REQUEST_METHOD must be one of: ${Array.from(SUPPORTED_METHODS).join(", ")}.`);
  }

  const requestTimeoutMs = readPositiveInteger(
    env,
    "REQUEST_TIMEOUT_MS",
    DEFAULT_REQUEST_TIMEOUT_MS,
    errors,
  );
  const minIntervalMs = readPositiveInteger(env, "MIN_INTERVAL_MS", DEFAULT_MIN_INTERVAL_MS, errors);
  const maxIntervalMs = readPositiveInteger(env, "MAX_INTERVAL_MS", DEFAULT_MAX_INTERVAL_MS, errors);
  const maxRetries = readPositiveInteger(env, "MAX_RETRIES", DEFAULT_MAX_RETRIES, errors);

  if (maxIntervalMs > FOURTEEN_MINUTES_MS) {
    errors.push(`MAX_INTERVAL_MS must not exceed ${FOURTEEN_MINUTES_MS} ms.`);
  }

  if (minIntervalMs > maxIntervalMs) {
    errors.push("MIN_INTERVAL_MS must not be greater than MAX_INTERVAL_MS.");
  }

  const customHeaders = readCustomHeaders(env.CUSTOM_HEADERS, errors);
  const authBearerToken = emptyToUndefined(env.AUTH_BEARER_TOKEN);
  if (authBearerToken && hasHeader(customHeaders, "authorization")) {
    errors.push("Do not set both AUTH_BEARER_TOKEN and an Authorization custom header.");
  }

  const requestBody = emptyToUndefined(env.REQUEST_BODY);
  if ((requestMethod === "GET" || requestMethod === "HEAD") && requestBody) {
    errors.push("REQUEST_BODY cannot be used with GET or HEAD requests.");
  }

  const resendApiKey = readRequiredString(env, "RESEND_API_KEY", errors);
  const alertToEmail = readRequiredString(env, "ALERT_TO_EMAIL", errors);
  const alertFromEmail = readRequiredString(env, "ALERT_FROM_EMAIL", errors);

  if (errors.length > 0) {
    throw new ConfigError(errors);
  }

  return {
    targetUrl: targetUrl!,
    requestMethod: requestMethod as HttpMethod,
    requestTimeoutMs,
    minIntervalMs,
    maxIntervalMs,
    maxRetries,
    allowNon2xx: parseBoolean(env.ALLOW_NON_2XX, false),
    resendApiKey: resendApiKey!,
    alertToEmail: alertToEmail!,
    alertFromEmail: alertFromEmail!,
    ...(authBearerToken ? { authBearerToken } : {}),
    customHeaders,
    ...(requestBody ? { requestBody } : {}),
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
