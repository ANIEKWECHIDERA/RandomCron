import type { ChartData } from "@/types";

export type ResponsePoint = ChartData["responseTimes"][number];

export interface ResponseSeriesRow {
  label: string;
  timestamp: string;
  originalDurations: Record<string, number>;
  [seriesKey: string]: string | number | Record<string, number>;
}

export interface ResponseSeries {
  key: string;
  name: string;
}

export const CHART_COLORS = [
  "var(--chart-2)",
  "var(--chart-1)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--destructive)",
];

export function buildResponseTimeSeries(
  points: ResponsePoint[],
  mode: "active" | "all" = "all",
  alignment: "timestamp" | "runIndex" = "timestamp",
): { data: ResponseSeriesRow[]; series: ResponseSeries[]; capMs: number } {
  if (points.length === 0) {
    return { data: [], series: [], capMs: 1_000 };
  }

  const durations = points.map((point) => point.durationMs).filter((duration) => duration > 0).sort((a, b) => a - b);
  const lowerMedian = durations[Math.floor((durations.length - 1) / 2)] ?? 1_000;
  const maxDuration = durations.at(-1) ?? lowerMedian;
  const capMs = Math.max(1_000, Math.min(maxDuration, lowerMedian * 4));
  const includedCronjobIds = new Set(
    mode === "active"
      ? points.filter((point) => point.cronjobEnabled !== false).map(getSeriesIdentity).filter(Boolean)
      : points.map(getSeriesIdentity).filter(Boolean),
  );
  const seriesById = new Map<string, ResponseSeries>();
  const rows = new Map<string, ResponseSeriesRow>();
  const includedPoints = points
    .map((point) => ({ point, identity: getSeriesIdentity(point) }))
    .filter((item): item is { point: ResponsePoint; identity: string } => !!item.identity && includedCronjobIds.has(item.identity));

  if (alignment === "runIndex") {
    const pointsBySeries = new Map<string, ResponsePoint[]>();

    for (const { point, identity } of includedPoints) {
      const key = `job_${identity.replace(/[^a-zA-Z0-9_]/g, "_")}`;
      seriesById.set(key, { key, name: point.cronjobTitle || "Cronjob" });
      pointsBySeries.set(key, [...(pointsBySeries.get(key) ?? []), point]);
    }

    for (const [key, seriesPoints] of pointsBySeries) {
      seriesPoints
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .forEach((point, index) => {
          const rowKey = String(index + 1);
          const existing: ResponseSeriesRow = rows.get(rowKey) ?? {
            label: `Run ${index + 1}`,
            timestamp: rowKey,
            originalDurations: {},
          };
          existing[key] = Math.min(point.durationMs, capMs);
          existing.originalDurations[key] = point.durationMs;
          rows.set(rowKey, existing);
        });
    }

    return {
      data: [...rows.values()].sort((a, b) => Number(a.timestamp) - Number(b.timestamp)),
      series: [...seriesById.values()],
      capMs,
    };
  }

  for (const { point, identity } of includedPoints) {
    const key = `job_${identity.replace(/[^a-zA-Z0-9_]/g, "_")}`;
    seriesById.set(key, { key, name: point.cronjobTitle || "Cronjob" });
    const rowKey = point.timestamp;
    const existing: ResponseSeriesRow = rows.get(rowKey) ?? {
      label: point.label,
      timestamp: point.timestamp,
      originalDurations: {},
    };
    existing[key] = Math.min(point.durationMs, capMs);
    existing.originalDurations[key] = point.durationMs;
    rows.set(rowKey, existing);
  }

  return { data: [...rows.values()], series: [...seriesById.values()], capMs };
}

function getSeriesIdentity(point: ResponsePoint) {
  return point.cronjobId || point.cronjobTitle;
}
