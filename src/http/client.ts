import type { HttpMethod } from "../config/index.js";
import { parseResponseBody, type ParsedResponseBody } from "./response.js";

export interface HttpRequestConfig {
  targetUrl: string;
  requestMethod: HttpMethod;
  requestTimeoutMs: number;
  allowNon2xx: boolean;
  customHeaders: Record<string, string>;
  requestBody?: string;
}

export interface HttpRequestResult extends ParsedResponseBody {
  timestamp: string;
  method: string;
  url: string;
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  durationMs: number;
}

export interface HttpRequestFailure extends Error {
  result?: HttpRequestResult;
  cause?: unknown;
}

export async function performHttpRequest(config: HttpRequestConfig): Promise<HttpRequestResult> {
  const startedAt = Date.now();
  const timestamp = new Date().toISOString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("Request timed out.")), config.requestTimeoutMs);

  try {
    const requestInit: RequestInit = {
      method: config.requestMethod,
      headers: buildHeaders(config),
      signal: controller.signal,
    };

    if (config.requestBody) {
      requestInit.body = config.requestBody;
    }

    const response = await fetch(config.targetUrl, requestInit);

    const parsedBody = await parseResponseBody(response);
    const result: HttpRequestResult = {
      timestamp,
      method: config.requestMethod,
      url: config.targetUrl,
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: headersToRecord(response.headers),
      durationMs: Date.now() - startedAt,
      ...parsedBody,
    };

    if (!response.ok && !config.allowNon2xx) {
      const failure = new Error(`HTTP ${response.status} ${response.statusText}`) as HttpRequestFailure;
      failure.result = result;
      throw failure;
    }

    return result;
  } catch (error) {
    if (isHttpRequestFailure(error)) {
      throw error;
    }

    const failure = new Error(toErrorMessage(error)) as HttpRequestFailure;
    failure.cause = error;
    throw failure;
  } finally {
    clearTimeout(timeout);
  }
}

function buildHeaders(config: HttpRequestConfig): HeadersInit {
  const headers: Record<string, string> = { ...config.customHeaders };

  if (config.requestBody && !hasHeader(headers, "content-type")) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

function headersToRecord(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries());
}

function hasHeader(headers: Record<string, string>, wantedHeader: string): boolean {
  return Object.keys(headers).some((header) => header.toLowerCase() === wantedHeader.toLowerCase());
}

export function isHttpRequestFailure(error: unknown): error is HttpRequestFailure {
  return error instanceof Error && "result" in error;
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
