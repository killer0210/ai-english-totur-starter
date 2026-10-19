type Level = "info" | "warn" | "error";
type Meta = Record<string, string | number | boolean | null | undefined>;

// Structured JSON logs. Callers pass IDs and metadata only — never message
// content, emails or tokens (docs/security.md §8).
function write(level: Level, event: string, meta: Meta = {}): void {
  const line = JSON.stringify({ level, event, ...meta, time: new Date().toISOString() });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const logger = {
  info: (event: string, meta?: Meta) => write("info", event, meta),
  warn: (event: string, meta?: Meta) => write("warn", event, meta),
  error: (event: string, meta?: Meta) => write("error", event, meta),
};
