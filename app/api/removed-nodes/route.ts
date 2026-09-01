import { readFile, stat } from "node:fs/promises";
import type { RemovedCycle, RemovedNodesResponse } from "@/types/removed-nodes";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const LW_CSV_PATH =
  process.env.REMOVED_NODES_CSV_PATH || "/tmp/ai_agent/removed_nodes.csv";
const DRL_CSV_PATH =
  process.env.REMOVED_NODES_CSV_PATH_DRL || "/tmp/drl_agent/removed_nodes.csv";

function csvPathForMode(mode: string | null): string {
  return mode === "drl" ? DRL_CSV_PATH : LW_CSV_PATH;
}

const EXPECTED_HEADER = [
  "cycle_id",
  "removed_at_timestamp",
  "node_id",
] as const;

function parseRemovedCsv(text: string): RemovedCycle[] {
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\r$/, ""))
    .filter((line) => line.trim() !== "");
  if (lines.length === 0) return [];

  const header = lines[0].split(",").map((col) => col.trim());
  if (
    header.length !== EXPECTED_HEADER.length ||
    header.some((col, i) => col !== EXPECTED_HEADER[i])
  ) {
    throw new Error(`Unexpected removed-nodes CSV header: "${lines[0]}"`);
  }

  const byCycle = new Map<number, RemovedCycle>();

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((cell) => cell.trim());
    if (cells.length !== EXPECTED_HEADER.length) {
      throw new Error(
        `removed-nodes CSV row ${i} has ${cells.length} columns, expected ${EXPECTED_HEADER.length}: "${lines[i]}"`,
      );
    }

    const cycleId = Number(cells[0]);
    const nodeId = Number(cells[2]);
    if (!Number.isFinite(cycleId) || !Number.isFinite(nodeId)) {
      throw new Error(
        `removed-nodes CSV row ${i} has a non-numeric value: "${lines[i]}"`,
      );
    }

    let cycle = byCycle.get(cycleId);
    if (!cycle) {
      cycle = { cycleId, timestamp: cells[1], nodeIds: [] };
      byCycle.set(cycleId, cycle);
    }
    if (!cycle.nodeIds.includes(nodeId)) cycle.nodeIds.push(nodeId);
  }

  return [...byCycle.values()].sort((a, b) => a.cycleId - b.cycleId);
}

function json(body: RemovedNodesResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  const csvPath = csvPathForMode(new URL(request.url).searchParams.get("mode"));

  let text: string;
  let updatedAt: string;

  try {
    const [fileText, stats] = await Promise.all([
      readFile(csvPath, "utf8"),
      stat(csvPath),
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
    return json(
      { status: "ok", cycles: parseRemovedCsv(text), updatedAt },
      200,
    );
  } catch (err) {
    return json({ status: "error", message: (err as Error).message }, 500);
  }
}
