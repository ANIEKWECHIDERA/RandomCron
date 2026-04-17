import { Activity, LayoutDashboard, ListChecks } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LiveStatus } from "@/components/live-status";
import { useRealtimeStatus } from "@/components/realtime-provider";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/cronjobs", label: "Cronjobs", icon: ListChecks },
];

export function AppLayout() {
  const realtimeStatus = useRealtimeStatus();

  return (
    <div className="min-h-screen bg-muted/30">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-background p-4 md:block">
        <div className="mb-8 flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Activity className="size-5" />
          </div>
          <div>
            <p className="font-semibold">RandomCron</p>
            <p className="text-xs text-muted-foreground">Worker control</p>
          </div>
        </div>
        <nav className="space-y-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground",
                  isActive && "bg-accent text-foreground",
                )
              }
            >
              <link.icon className="size-4" />
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="md:pl-64">
        <header className="sticky top-0 z-10 border-b bg-background/95 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex items-center justify-between">
            <div className="md:hidden">
              <p className="font-semibold">RandomCron</p>
            </div>
            <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
              <LiveStatus status={realtimeStatus} />
              <span className="hidden sm:inline">Randomized endpoint monitoring</span>
            </div>
          </div>
        </header>
        <main className="p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
