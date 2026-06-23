type LogLevel = "debug" | "info" | "warn" | "error";

export function logStructured(level: LogLevel, message: string, data: Record<string, unknown> = {}) {
  const entry = {
    level,
    message,
    service: process.env.APP_NAME ?? "aoc-app-template-nextjs",
    timestamp: new Date().toISOString(),
    ...data
  };

  const line = JSON.stringify(redact(entry));
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redact);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => {
      if (/(secret|token|password|connection_string)/i.test(key)) {
        return [key, "[redacted]"];
      }
      return [key, redact(child)];
    })
  );
}
