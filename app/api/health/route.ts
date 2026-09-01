import { readFile, stat } from "node:fs/promises";
import type { HealthResponse } from "@/types/health";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

// Node health is a DRL-agent concept only.
const CSV_PATH = process.env.HEALTH_CSV_PATH || "/tmp/drl_agent/health.csv";

const EXPECTED_HEADER = ["node_id", "health"] as const;

function parseHealthCsv(text: string): Record<string, number> {
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\r$/, ""))
    .filter((line) => line.trim() !== "");
  if (lines.length === 0) return {};

  const header = lines[0].split(",").map((col) => col.trim());
  if (
    header.length !== EXPECTED_HEADER.length ||
    header.some((col, i) => col !== EXPECTED_HEADER[i])
  ) {
    throw new Error(`Unexpected health CSV header: "${lines[0]}"`);
  }

  const out: Record<string, number> = {};
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((cell) => cell.trim());
    if (cells.length !== EXPECTED_HEADER.length) {
      throw new Error(
        `health CSV row ${i} has ${cells.length} columns, expected ${EXPECTED_HEADER.length}: "${lines[i]}"`,
      );
    }
    const id = Number(cells[0]);
    const value = Number(cells[1]);
    if (!Number.isFinite(id) || !Number.isFinite(value)) {
      throw new Error(
        `health CSV row ${i} has a non-numeric value: "${lines[i]}"`,
      );
    }
    out[String(id)] = value;
  }
  return out;
}

function json(body: HealthResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(): Promise<Response> {
  let text: string;
  let updatedAt: string;

  try {
    const [fileText, stats] = await Promise.all([
      readFile(CSV_PATH, "utf8"),
      stat(CSV_PATH),
    ]);
    text = fileText;
    updatedAt = stats.mtime.toISOString();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return json({ status: "waiting" }, 200);
    }
    return json({ status: "error", message: (err as Error).message }, 500);
  }

  try {
    return json({ status: "ok", health: parseHealthCsv(text), updatedAt }, 200);
  } catch (err) {
    return json({ status: "error", message: (err as Error).message }, 500);
  }
}
