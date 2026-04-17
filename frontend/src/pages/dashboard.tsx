import { Activity, AlertTriangle, CheckCircle2, Clock, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartFrame } from "@/components/chart-frame";
import { StatusBadge } from "@/components/status-badge";
import { api } from "@/lib/api";
import { buildResponseTimeSeries, CHART_COLORS, type ResponseSeriesRow } from "@/lib/chart";
import { formatDate, formatDuration } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";

export function DashboardPage() {
  const stats = useQuery({ queryKey: queryKeys.stats, queryFn: api.stats });
  const charts = useQuery({ queryKey: queryKeys.charts, queryFn: () => api.charts() });
  const events = useQuery({ queryKey: queryKeys.recentEvents, queryFn: api.recentEvents });
  const streaks = useQuery({ queryKey: queryKeys.failureStreaks, queryFn: api.failureStreaks });
  const responseTimeTrend = useMemo(
    () => buildResponseTimeSeries(charts.data?.data.responseTimes ?? [], "active", "runIndex"),
    [charts.data?.data.responseTimes],
  );

  if (stats.isLoading || charts.isLoading || events.isLoading || streaks.isLoading) {
    return <div className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-80" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Live scheduler health, events, and response trends.</p>
        </div>
        <Button asChild><Link to="/cronjobs"><Plus className="mr-2 size-4" />Create Cronjob</Link></Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat title="Enabled Cronjobs" value={stats.data?.data.enabledCronjobs ?? 0} icon={Activity} />
        <Stat title="Disabled Cronjobs" value={stats.data?.data.disabledCronjobs ?? 0} icon={Clock} />
        <Stat title="Successful Cronjobs" value={stats.data?.data.successfulCronjobs ?? 0} icon={CheckCircle2} />
        <Stat title="Failed Cronjobs" value={stats.data?.data.failedCronjobs ?? 0} icon={AlertTriangle} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Response time trend</CardTitle>
            <p className="text-sm text-muted-foreground">
              Active cronjobs aligned by run number. Display is capped at {formatDuration(responseTimeTrend.capMs)}.
            </p>
          </CardHeader>
          <CardContent className="h-80 min-w-0">
            <ChartFrame>
              {({ width, height }) => (
              <LineChart width={width} height={height} data={responseTimeTrend.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis tickFormatter={(value) => formatDuration(Number(value))} />
                <Legend />
                <Tooltip
                  formatter={(_value, _name, item) => {
                    const payload = item.payload as ResponseSeriesRow;
                    const dataKey = String(item.dataKey);
                    const series = responseTimeTrend.series.find((itemSeries) => itemSeries.key === dataKey);
                    const original = series ? payload.originalDurations[series.key] : undefined;
                    return [
                      original && original > responseTimeTrend.capMs
                        ? `${formatDuration(original)} actual, shown at ${formatDuration(responseTimeTrend.capMs)}`
                        : formatDuration(Number(_value)),
                      series?.name ?? String(_name),
                    ];
                  }}
                />
                {responseTimeTrend.series.map((series, index) => (
                  <Line
                    key={series.key}
                    type="monotone"
                    dataKey={series.key}
                    name={series.name}
                    stroke={CHART_COLORS[index % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    connectNulls
                  />
                ))}
              </LineChart>
              )}
            </ChartFrame>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Success vs failure</CardTitle></CardHeader>
          <CardContent className="h-80 min-w-0">
            <ChartFrame>
              {({ width, height }) => (
              <BarChart width={width} height={height} data={charts.data?.data.successFailure ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="success" fill="var(--chart-2)" />
                <Bar dataKey="failure" fill="var(--destructive)" />
              </BarChart>
              )}
            </ChartFrame>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Last Events</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Event</TableHead><TableHead>Date</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {(events.data?.data ?? []).map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <div className="font-medium">{event.cronjobTitle}</div>
                      <div className="text-sm text-muted-foreground">{event.success ? "Request succeeded" : event.errorMessage}</div>
                    </TableCell>
                    <TableCell>{formatDate(event.startedAt)}</TableCell>
                    <TableCell><StatusBadge status={event.success ? "success" : "failed"} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Consecutive failures</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(streaks.data?.data ?? []).length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">No active failure streaks.</div>
            ) : (
              (streaks.data?.data ?? []).map((job) => (
                <Link key={job.id} to={`/cronjobs/${job.id}`} className="block rounded-md border p-3 hover:bg-accent">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{job.title}</span>
                    <span className="text-sm text-destructive">{job.consecutiveFailures} failures</span>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">{formatDuration(job.averageResponseTimeMs)}</div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ title, value, icon: Icon }: { title: string; value: number; icon: typeof Activity }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent><div className="text-2xl font-semibold">{value}</div></CardContent>
    </Card>
  );
}
