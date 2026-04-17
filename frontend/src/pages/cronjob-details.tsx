import { ArrowLeft, ChevronLeft, ChevronRight, Edit, Play, Square } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Line, LineChart, Tooltip, XAxis, YAxis, CartesianGrid, Bar, BarChart, Legend } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CronjobFormDialog } from "@/components/cronjob-form-dialog";
import { ChartFrame } from "@/components/chart-frame";
import { ExecutionDialog } from "@/components/execution-dialog";
import { JsonView } from "@/components/json-view";
import { StatusBadge } from "@/components/status-badge";
import { api } from "@/lib/api";
import { buildResponseTimeSeries, CHART_COLORS, type ResponseSeriesRow } from "@/lib/chart";
import { formatDate, formatDuration } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import type { Cronjob, CronjobExecution, CronjobFormValues } from "@/types";

export function CronjobDetailsPage() {
  const { id } = useParams();
  const [formOpen, setFormOpen] = useState(false);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [activeTab, setActiveTab] = useState("overview");
  const queryClient = useQueryClient();
  const cronjobQuery = useQuery({
    queryKey: queryKeys.cronjob(id ?? ""),
    queryFn: () => api.cronjob(id!),
    enabled: !!id,
  });
  const historyQuery = useQuery({
    queryKey: queryKeys.history(id ?? "", historyPage, historyPageSize),
    queryFn: () => api.history(id!, historyPage, historyPageSize),
    enabled: !!id,
  });
  const chartQuery = useQuery({
    queryKey: [...queryKeys.charts, id],
    queryFn: () => api.charts(id),
    enabled: !!id,
  });
  const cronjob = cronjobQuery.data?.data ?? null;
  const history = historyQuery.data?.data ?? [];
  const historyMeta = historyQuery.data?.meta ?? { page: historyPage, pageSize: historyPageSize, total: 0 };
  const detailResponseTrend = useMemo(
    () => buildResponseTimeSeries(chartQuery.data?.data.responseTimes ?? [], "all"),
    [chartQuery.data?.data.responseTimes],
  );

  const load = async () => {
    if (!id) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.cronjob(id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.historyRoot(id) }),
    ]);
  };

  if (cronjobQuery.isLoading || historyQuery.isLoading || !cronjob) {
    return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-96" /></div>;
  }

  const submit = async (values: CronjobFormValues) => {
    await api.updateCronjob(cronjob.id, values);
    toast.success("Cronjob updated.");
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Button asChild variant="ghost" className="mb-2 px-0"><Link to="/cronjobs"><ArrowLeft className="mr-2 size-4" />Back to cronjobs</Link></Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{cronjob.title}</h1>
            <StatusBadge status={cronjob.currentStatus} enabled={cronjob.enabled} />
          </div>
          <p className="mt-1 break-all text-sm text-muted-foreground">{cronjob.url}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setFormOpen(true)}><Edit className="mr-2 size-4" />Edit</Button>
          {cronjob.enabled ? (
            <Button variant="outline" onClick={() => void api.disableCronjob(cronjob.id).then(load)}><Square className="mr-2 size-4" />Disable</Button>
          ) : (
            <Button onClick={() => void api.enableCronjob(cronjob.id).then(load)}><Play className="mr-2 size-4" />Enable</Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Info title="Last execution" value={formatDate(cronjob.lastExecutionAt)} />
        <Info title="Next execution" value={formatDate(cronjob.nextExecutionAt)} />
        <Info title="Consecutive failures" value={String(cronjob.consecutiveFailures)} />
        <Info title="Average response" value={formatDuration(cronjob.averageResponseTimeMs)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Response time trend</CardTitle>
            <p className="text-sm text-muted-foreground">
              Display is capped at {formatDuration(detailResponseTrend.capMs)} to keep normal runs readable.
            </p>
          </CardHeader>
          <CardContent className="h-72 min-w-0">
            <ChartFrame>
              {({ width, height }) => (
              <LineChart width={width} height={height} data={detailResponseTrend.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis tickFormatter={(value) => formatDuration(Number(value))} />
                <Legend />
                <Tooltip
                  formatter={(_value, _name, item) => {
                    const payload = item.payload as ResponseSeriesRow;
                    const dataKey = String(item.dataKey);
                    const series = detailResponseTrend.series.find((itemSeries) => itemSeries.key === dataKey);
                    const original = series ? payload.originalDurations[series.key] : undefined;
                    return [
                      original && original > detailResponseTrend.capMs
                        ? `${formatDuration(original)} actual, shown at ${formatDuration(detailResponseTrend.capMs)}`
                        : formatDuration(Number(_value)),
                      series?.name ?? "Response time",
                    ];
                  }}
                />
                {detailResponseTrend.series.map((series, index) => (
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
          <CardContent className="h-72 min-w-0">
            <ChartFrame>
              {({ width, height }) => (
              <BarChart width={width} height={height} data={chartQuery.data?.data.successFailure ?? []}>
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="response">Response data</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4 grid gap-4 md:grid-cols-3">
          <Info title="Total runs" value={String(cronjob.totalRuns ?? 0)} />
          <Info title="Success count" value={String(cronjob.successCount ?? 0)} />
          <Info title="Failure count" value={String(cronjob.failureCount ?? 0)} />
          <Info title="Last success" value={formatDate(cronjob.lastSuccessAt)} />
          <Info title="Last failure" value={formatDate(cronjob.lastFailureAt)} />
          <Info title="Max retries" value={String(cronjob.maxRetries)} />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <HistoryTable
            history={history}
            meta={historyMeta}
            pageSize={historyPageSize}
            onOpen={setExecutionId}
            onPageChange={setHistoryPage}
            onPageSizeChange={(value) => {
              setHistoryPageSize(value);
              setHistoryPage(1);
            }}
          />
        </TabsContent>
        <TabsContent value="response" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Latest response snapshot</CardTitle></CardHeader>
            <CardContent><JsonView value={cronjob.latestExecution?.responseBody} /></CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
              <Info title="Method" value={cronjob.method} />
              <Info title="Timeout" value={formatDuration(cronjob.timeoutMs)} />
              <Info title="Min interval" value={formatDuration(cronjob.minIntervalMs)} />
              <Info title="Max interval" value={formatDuration(cronjob.maxIntervalMs)} />
              <Info title="Alert email" value={cronjob.alertToEmail ?? "Global default"} />
              <Info title="Allow non-2xx" value={cronjob.allowNon2xx ? "Yes" : "No"} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CronjobFormDialog open={formOpen} onOpenChange={setFormOpen} cronjob={cronjob} onSubmit={submit} />
      <ExecutionDialog executionId={executionId} open={!!executionId} onOpenChange={(open) => !open && setExecutionId(null)} />
    </div>
  );
}

function Info({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader>
      <CardContent><p className="break-words text-sm text-muted-foreground">{value}</p></CardContent>
    </Card>
  );
}

function HistoryTable({
  history,
  meta,
  pageSize,
  onOpen,
  onPageChange,
  onPageSizeChange,
}: {
  history: CronjobExecution[];
  meta: { page: number; pageSize: number; total: number };
  pageSize: number;
  onOpen: (id: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(meta.total / pageSize));
  const currentPage = Math.min(meta.page, totalPages);

  return (
    <Card>
      <CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Status code</TableHead>
              <TableHead>Response time</TableHead>
              <TableHead>Retry</TableHead>
              <TableHead>Alert</TableHead>
              <TableHead>Preview</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((execution) => (
              <TableRow key={execution.id} className="cursor-pointer" onClick={() => onOpen(execution.id)}>
                <TableCell>{formatDate(execution.startedAt)}</TableCell>
                <TableCell><StatusBadge status={execution.success ? "success" : "failed"} /></TableCell>
                <TableCell>{execution.statusCode ?? "n/a"}</TableCell>
                <TableCell>{formatDuration(execution.durationMs)}</TableCell>
                <TableCell>{execution.retryAttempt}</TableCell>
                <TableCell>{execution.alertSent ? "sent" : "not sent"}</TableCell>
                <TableCell className="max-w-[320px] truncate">{execution.responsePreview || execution.errorMessage || "No response body"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex flex-col gap-3 border-t px-2 py-4 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {meta.total === 0 ? 0 : (currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, meta.total)} of {meta.total}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rows</span>
              <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
                <SelectTrigger className="h-8 w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 30, 40, 50].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                size="icon"
                variant="outline"
                disabled={currentPage <= 1}
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                disabled={currentPage >= totalPages}
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
