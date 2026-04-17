import { truncateText } from "../utils/text.js";

const DEFAULT_BODY_LOG_LIMIT = 16_000;

export interface ParsedResponseBody {
  body: string;
  bodyForLog: string;
  bodyKind: "json" | "text" | "empty" | "unreadable";
  bodyTruncated: boolean;
}

export async function parseResponseBody(
  response: Response,
  maxBodyLength = DEFAULT_BODY_LOG_LIMIT,
): Promise<ParsedResponseBody> {
  let rawBody = "";

  try {
    rawBody = await response.text();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      body: "",
      bodyForLog: `Unable to read response body: ${message}`,
      bodyKind: "unreadable",
      bodyTruncated: false,
    };
  }

  if (!rawBody) {
    return {
      body: "",
      bodyForLog: "",
      bodyKind: "empty",
      bodyTruncated: false,
    };
  }

  const contentType = response.headers.get("content-type") ?? "";
  const looksJson = contentType.toLowerCase().includes("json");
  const printableBody = looksJson ? tryPrettyJson(rawBody) : rawBody;
  const truncated = truncateText(printableBody, maxBodyLength);

  return {
    body: rawBody,
    bodyForLog: truncated.value,
    bodyKind: looksJson ? "json" : "text",
    bodyTruncated: truncated.truncated,
  };
}

function tryPrettyJson(rawBody: string): string {
  try {
    return JSON.stringify(JSON.parse(rawBody), null, 2);
  } catch {
    return rawBody;
  }
}
