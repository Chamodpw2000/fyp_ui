import { readFile, stat } from "node:fs/promises";
import type { AttackTypeLabel, MccRow, MccTableResponse } from "@/types/mcc";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const LW_CSV_PATH = process.env.MCC_TABLE_CSV_PATH || "/tmp/ai_agent/mcc_table_latest.csv";
const DRL_CSV_PATH =
  process.env.MCC_TABLE_CSV_PATH_DRL || "/tmp/drl_agent/mcc_table_latest.csv";

function csvPathForMode(mode: string | null): string {
  return mode === "drl" ? DRL_CSV_PATH : LW_CSV_PATH;
}

const EXPECTED_HEADER = [
  "Attack Type",
  "TP",
  "FP",
  "TN",
  "FN",
  "MCC",
  "Avg TP Latency",
] as const;

const VALID_LABELS: ReadonlySet<string> = new Set<AttackTypeLabel>([
  "Split Path",
  "Flow Stretching",
  "Interleaved Jamming",
  "Asym Link Spoofing",
  "All Attacks (Overall)",
]);

function parseMccCsv(text: string): MccRow[] {
  const lines = text.split("\n").map((line) => line.replace(/\r$/, ""));
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
  if (lines.length === 0) throw new Error("MCC CSV file is empty");

  const header = lines[0].split(",");
  if (
    header.length !== EXPECTED_HEADER.length ||
    header.some((col, i) => col.trim() !== EXPECTED_HEADER[i])
  ) {
    throw new Error(`Unexpected MCC CSV header: "${lines[0]}"`);
  }

  const rows: MccRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;

    const cells = line.split(",").map((cell) => cell.trim());
    if (cells.length !== EXPECTED_HEADER.length) {
      throw new Error(
        `MCC CSV row ${i} has ${cells.length} columns, expected ${EXPECTED_HEADER.length}: "${line}"`,
      );
    }

    const [label, tpRaw, fpRaw, tnRaw, fnRaw, mccRaw, latencyRaw] = cells;

    if (!VALID_LABELS.has(label)) {
      throw new Error(`MCC CSV row ${i} has an unknown attack type: "${label}"`);
    }

    const int = (raw: string, column: string): number => {
      const value = Number(raw);
      if (Number.isNaN(value)) {
        throw new Error(`MCC CSV row ${i} column ${column} is not a number: "${raw}"`);
      }
      return value;
    };

    const mcc = Number(mccRaw);
    if (Number.isNaN(mcc)) {
      throw new Error(`MCC CSV row ${i} column MCC is not a number: "${mccRaw}"`);
    }

    let avgTpLatency: number | null;
    if (latencyRaw === "N/A") {
      avgTpLatency = null;
    } else {
      const value = Number(latencyRaw);
      if (Number.isNaN(value)) {
        throw new Error(
          `MCC CSV row ${i} column Avg TP Latency is not a number: "${latencyRaw}"`,
        );
      }
      avgTpLatency = value;
    }

    rows.push({
      attackType: label as AttackTypeLabel,
      tp: int(tpRaw, "TP"),
      fp: int(fpRaw, "FP"),
      tn: int(tnRaw, "TN"),
      fn: int(fnRaw, "FN"),
      mcc,
      avgTpLatency,
    });
  }

  return rows;
}

function json(body: MccTableResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
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
    const rows = parseMccCsv(text);
    return json({ status: "ok", rows, updatedAt }, 200);
  } catch (err) {
    return json({ status: "error", message: (err as Error).message }, 500);
  }
}
