import { Activity, AlertTriangle, CheckCircle2, Clock, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { api } from "@/lib/api";
import { formatDate, formatDuration } from "@/lib/format";
import type { ChartData, Cronjob, CronjobExecution, DashboardStats } from "@/types";

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [charts, setCharts] = useState<ChartData | null>(null);
  const [events, setEvents] = useState<CronjobExecution[]>([]);
  const [streaks, setStreaks] = useState<Cronjob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.stats(), api.charts(), api.recentEvents(), api.failureStreaks()])
      .then(([statsResponse, chartResponse, eventsResponse, streakResponse]) => {
        setStats(statsResponse.data);
        setCharts(chartResponse.data);
        setEvents(eventsResponse.data);
        setStreaks(streakResponse.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
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
        <Stat title="Enabled Cronjobs" value={stats?.enabledCronjobs ?? 0} icon={Activity} />
        <Stat title="Disabled Cronjobs" value={stats?.disabledCronjobs ?? 0} icon={Clock} />
        <Stat title="Successful Cronjobs" value={stats?.successfulCronjobs ?? 0} icon={CheckCircle2} />
        <Stat title="Failed Cronjobs" value={stats?.failedCronjobs ?? 0} icon={AlertTriangle} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Response time trend</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts?.responseTimes ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="durationMs" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Success vs failure</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts?.successFailure ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="success" fill="var(--chart-2)" />
                <Bar dataKey="failure" fill="var(--destructive)" />
              </BarChart>
            </ResponsiveContainer>
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
                {events.map((event) => (
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
            {streaks.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">No active failure streaks.</div>
            ) : (
              streaks.map((job) => (
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
