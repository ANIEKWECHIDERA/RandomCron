export const queryKeys = {
  cronjobs: ["cronjobs"] as const,
  cronjob: (id: string) => ["cronjob", id] as const,
  historyRoot: (id: string) => ["history", id] as const,
  history: (id: string, page = 1, pageSize = 20) => ["history", id, page, pageSize] as const,
  stats: ["dashboard", "stats"] as const,
  charts: ["dashboard", "charts"] as const,
  recentEvents: ["dashboard", "recent-events"] as const,
  failureStreaks: ["dashboard", "failure-streaks"] as const,
};
