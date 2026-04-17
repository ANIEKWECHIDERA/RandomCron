import pino from "pino";

export function createLogger(level: string) {
  return pino({
    level,
    base: null,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
  });
}

export type Logger = ReturnType<typeof createLogger>;
