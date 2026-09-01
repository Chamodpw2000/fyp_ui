export type HealthResponse =
  | { status: "ok"; health: Record<string, number>; updatedAt: string } // updatedAt = file mtime, ISO string
  | { status: "waiting" } // file does not exist yet
  | { status: "error"; message: string };
