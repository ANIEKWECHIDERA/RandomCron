import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { formatDate, formatDuration } from "@/lib/format";
import type { CronjobExecution } from "@/types";
import { JsonView } from "./json-view";

export function ExecutionDialog({
  executionId,
  open,
  onOpenChange,
}: {
  executionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [execution, setExecution] = useState<CronjobExecution | null>(null);

  useEffect(() => {
    if (!executionId || !open) return;
    void api.execution(executionId).then((response) => setExecution(response.data));
  }, [executionId, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Execution details</DialogTitle>
        </DialogHeader>
        {execution ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <Info label="Status" value={execution.success ? "Success" : "Failed"} />
              <Info label="HTTP" value={execution.statusCode ? `${execution.statusCode} ${execution.statusText ?? ""}` : "n/a"} />
              <Info label="Duration" value={formatDuration(execution.durationMs)} />
              <Info label="Alert" value={execution.alertSent ? "sent" : "not sent"} />
            </div>
            <Tabs defaultValue="response">
              <TabsList>
                <TabsTrigger value="response">Response</TabsTrigger>
                <TabsTrigger value="request">Request</TabsTrigger>
                <TabsTrigger value="meta">Meta</TabsTrigger>
              </TabsList>
              <TabsContent value="response" className="space-y-3">
                <Badge variant="outline">{execution.parsedResponseType}</Badge>
                <JsonView value={execution.responseBody} />
              </TabsContent>
              <TabsContent value="request" className="space-y-3">
                <JsonView value={JSON.stringify(execution.requestHeaders ?? {}, null, 2)} />
                <JsonView value={execution.requestBody} />
              </TabsContent>
              <TabsContent value="meta" className="grid gap-3 md:grid-cols-2">
                <Info label="Started" value={formatDate(execution.startedAt)} />
                <Info label="Completed" value={formatDate(execution.completedAt)} />
                <Info label="Retry attempt" value={String(execution.retryAttempt)} />
                <Info label="Failure reason" value={execution.errorMessage ?? "n/a"} />
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="py-10 text-sm text-muted-foreground">Loading execution...</div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium">{value}</p>
    </div>
  );
}
