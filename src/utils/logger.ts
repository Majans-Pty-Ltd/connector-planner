export function log(...args: unknown[]): void {
  console.error("[connector-planner]", ...args);
}

export function logError(message: string, error?: unknown): void {
  console.error("[connector-planner] ERROR:", message, error);
}
