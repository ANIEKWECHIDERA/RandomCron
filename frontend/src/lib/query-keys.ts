export const queryKeys = {
  cronjobs: ["cronjobs"] as const,
  cronjob: (id: string) => ["cronjob", id] as const,
  history: (id: string) => ["history", id] as const,
  stats: ["dashboard", "stats"] as const,
  charts: ["dashboard", "charts"] as const,
  recentEvents: ["dashboard", "recent-events"] as const,
  failureStreaks: ["dashboard", "failure-streaks"] as const,
};
