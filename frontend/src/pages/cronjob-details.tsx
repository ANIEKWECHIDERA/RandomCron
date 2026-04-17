import { ArrowLeft, Edit, Play, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CronjobFormDialog } from "@/components/cronjob-form-dialog";
import { ExecutionDialog } from "@/components/execution-dialog";
import { JsonView } from "@/components/json-view";
import { StatusBadge } from "@/components/status-badge";
import { api } from "@/lib/api";
import { formatDate, formatDuration } from "@/lib/format";
import type { Cronjob, CronjobExecution, CronjobFormValues } from "@/types";

export function CronjobDetailsPage() {
  const { id } = useParams();
  const [cronjob, setCronjob] = useState<Cronjob | null>(null);
  const [history, setHistory] = useState<CronjobExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [executionId, setExecutionId] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [jobResponse, historyResponse] = await Promise.all([api.cronjob(id), api.history(id)]);
      setCronjob(jobResponse.data);
      setHistory(historyResponse.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  if (loading || !cronjob) {
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

      <Tabs defaultValue="overview">
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
          <HistoryTable history={history} onOpen={setExecutionId} />
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

function HistoryTable({ history, onOpen }: { history: CronjobExecution[]; onOpen: (id: string) => void }) {
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
      </CardContent>
    </Card>
  );
}
