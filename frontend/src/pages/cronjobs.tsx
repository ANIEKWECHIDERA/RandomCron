import { ChevronLeft, ChevronRight, MoreHorizontal, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDelete } from "@/components/confirm-delete";
import { CronjobFormDialog } from "@/components/cronjob-form-dialog";
import { StatusBadge } from "@/components/status-badge";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import type { Cronjob, CronjobFormValues } from "@/types";

export function CronjobsPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Cronjob | null>(null);
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const queryClient = useQueryClient();
  const cronjobsQuery = useQuery({ queryKey: queryKeys.cronjobs, queryFn: api.cronjobs });
  const cronjobs = cronjobsQuery.data?.data ?? [];

  const filtered = useMemo(
    () => cronjobs.filter((job) => `${job.title} ${job.url}`.toLowerCase().includes(search.toLowerCase())),
    [cronjobs, search],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleCronjobs = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, filtered, pageSize],
  );
  const visibleIds = visibleCronjobs.map((job) => job.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));

  useEffect(() => {
    setPage(1);
    setSelected([]);
  }, [pageSize, search]);

  const mutate = async (action: () => Promise<unknown>, message: string) => {
    await action();
    toast.success(message);
    setSelected([]);
    await queryClient.invalidateQueries({ queryKey: queryKeys.cronjobs });
  };

  const submit = async (values: CronjobFormValues) => {
    if (editing) {
      await mutate(() => api.updateCronjob(editing.id, values), "Cronjob updated.");
      setEditing(null);
    } else {
      await mutate(() => api.createCronjob(values), "Cronjob created.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cronjobs</h1>
          <p className="text-sm text-muted-foreground">Create, schedule, and inspect randomized endpoint workers.</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="mr-2 size-4" />Create Cronjob</Button>
      </div>

      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle>All cronjobs</CardTitle>
          <div className="flex flex-col gap-2 md:flex-row">
            {selected.length > 0 && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => void mutate(() => api.bulkEnable(selected), "Cronjobs enabled.")}>Enable</Button>
                <Button size="sm" variant="outline" onClick={() => void mutate(() => api.bulkDisable(selected), "Cronjobs disabled.")}>Disable</Button>
                <Button size="sm" variant="destructive" onClick={() => setDeleteIds(selected)}>Delete</Button>
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search cronjobs" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {cronjobsQuery.isLoading ? (
            <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-24" /></div>
          ) : filtered.length === 0 ? (
            <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">No cronjobs yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={(checked) =>
                          setSelected((current) =>
                            checked
                              ? Array.from(new Set([...current, ...visibleIds]))
                              : current.filter((id) => !visibleIds.includes(id)),
                          )
                        }
                      />
                    </TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Last execution</TableHead>
                    <TableHead>Next execution</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleCronjobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <Checkbox
                          checked={selected.includes(job.id)}
                          onCheckedChange={(checked) =>
                            setSelected((current) => checked ? [...current, job.id] : current.filter((id) => id !== job.id))
                          }
                        />
                      </TableCell>
                      <TableCell><Link className="font-medium hover:underline" to={`/cronjobs/${job.id}`}>{job.title}</Link></TableCell>
                      <TableCell className="max-w-[340px] truncate text-muted-foreground">{job.url}</TableCell>
                      <TableCell>{formatDate(job.lastExecutionAt)}</TableCell>
                      <TableCell>{formatDate(job.nextExecutionAt)}</TableCell>
                      <TableCell><StatusBadge status={job.currentStatus} enabled={job.enabled} /></TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!job.enabled && (
                              <DropdownMenuItem onClick={() => void mutate(() => api.enableCronjob(job.id), "Cronjob enabled.")}>Enable</DropdownMenuItem>
                            )}
                            {job.enabled && (
                              <DropdownMenuItem onClick={() => void mutate(() => api.disableCronjob(job.id), "Cronjob disabled.")}>Disable</DropdownMenuItem>
                            )}
                            <DropdownMenuItem asChild><Link to={`/cronjobs/${job.id}`}>History</Link></DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setEditing(job); setFormOpen(true); }}>Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDeleteIds([job.id])}>Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex flex-col gap-3 border-t px-2 py-4 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}-
                  {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Rows</span>
                    <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
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
                      onClick={() => setPage((value) => Math.max(1, value - 1))}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      disabled={currentPage >= totalPages}
                      onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CronjobFormDialog open={formOpen} onOpenChange={setFormOpen} cronjob={editing} onSubmit={submit} />
      <ConfirmDelete
        open={!!deleteIds}
        onOpenChange={(open) => !open && setDeleteIds(null)}
        label={deleteIds && deleteIds.length > 1 ? `${deleteIds.length} cronjobs` : "cronjob"}
        onConfirm={() => {
          const ids = deleteIds ?? [];
          setDeleteIds(null);
          void mutate(() => (ids.length === 1 ? api.deleteCronjob(ids[0]!) : api.bulkDelete(ids)), "Cronjob deleted.");
        }}
      />
    </div>
  );
}
