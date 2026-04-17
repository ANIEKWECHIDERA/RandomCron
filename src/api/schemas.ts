import { z } from "zod";
import { FOURTEEN_MINUTES_MS } from "../config/index.js";

const httpMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

const headersSchema = z
  .record(z.string(), z.string())
  .default({})
  .refine((headers) => Object.keys(headers).every((key) => key.trim().length > 0), {
    message: "Header names cannot be empty.",
  });

const cronjobBaseSchema = z.object({
    title: z.string().trim().min(1, "Title is required."),
    url: z.string().trim().url("URL must be valid."),
    method: httpMethodSchema.default("GET"),
    headers: headersSchema,
    body: z.string().optional().nullable(),
    minIntervalMs: z.coerce.number().int().positive().default(60_000),
    maxIntervalMs: z.coerce.number().int().positive().max(FOURTEEN_MINUTES_MS).default(FOURTEEN_MINUTES_MS),
    timeoutMs: z.coerce.number().int().positive().default(30_000),
    maxRetries: z.coerce.number().int().positive().default(10),
    enabled: z.boolean().default(true),
    allowNon2xx: z.boolean().default(false),
    alertToEmail: z.string().email().optional().nullable().or(z.literal("")),
    alertFromEmail: z.string().optional().nullable(),
  });

export const cronjobInputSchema = cronjobBaseSchema
  .refine((value) => value.minIntervalMs <= value.maxIntervalMs, {
    path: ["minIntervalMs"],
    message: "Min interval must be less than or equal to max interval.",
  })
  .refine((value) => !["GET", "HEAD"].includes(value.method) || !value.body, {
    path: ["body"],
    message: "GET and HEAD requests cannot include a request body.",
  });

export const cronjobUpdateSchema = cronjobBaseSchema.partial().refine(
  (value) =>
    value.minIntervalMs === undefined ||
    value.maxIntervalMs === undefined ||
    value.minIntervalMs <= value.maxIntervalMs,
  {
    path: ["minIntervalMs"],
    message: "Min interval must be less than or equal to max interval.",
  },
);

export const bulkIdsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Select at least one cronjob."),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
