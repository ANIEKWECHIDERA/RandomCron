import { MoreHorizontal, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDelete } from "@/components/confirm-delete";
import { CronjobFormDialog } from "@/components/cronjob-form-dialog";
import { StatusBadge } from "@/components/status-badge";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Cronjob, CronjobFormValues } from "@/types";

export function CronjobsPage() {
  const [cronjobs, setCronjobs] = useState<Cronjob[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Cronjob | null>(null);
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);

  const filtered = useMemo(
    () => cronjobs.filter((job) => `${job.title} ${job.url}`.toLowerCase().includes(search.toLowerCase())),
    [cronjobs, search],
  );

  const load = async () => {
    setLoading(true);
    try {
      setCronjobs((await api.cronjobs()).data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const mutate = async (action: () => Promise<unknown>, message: string) => {
    await action();
    toast.success(message);
    setSelected([]);
    await load();
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
          {loading ? (
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
                        checked={selected.length === filtered.length}
                        onCheckedChange={(checked) => setSelected(checked ? filtered.map((job) => job.id) : [])}
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
                  {filtered.map((job) => (
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
                            <DropdownMenuItem onClick={() => void mutate(() => api.enableCronjob(job.id), "Cronjob enabled.")}>Enable</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void mutate(() => api.disableCronjob(job.id), "Cronjob disabled.")}>Disable</DropdownMenuItem>
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
