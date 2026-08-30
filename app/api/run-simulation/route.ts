import { spawn } from "node:child_process";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Allow long-running ns-3 simulations.
export const maxDuration = 3600;

// Directory that contains the `waf` script (the ns-3 root).
// Override with the NS3_DIR environment variable.
const NS3_DIR = process.env.NS3_DIR || "/home/chamod/ns-allinone-3.35/ns-3.35";

const ATTACK_CATEGORIES = [
  "split_path",
  "interleaved_jamming",
  "flow_stretching",
  "asymmetric_spoofing",
] as const;
type AttackCategory = (typeof ATTACK_CATEGORIES)[number];

const MIN_NODE_ID = 1;
const MAX_NODE_ID = 321;

const DEFAULTS = {
  simTime: 300,
  attackSeed: 12345,
  splitPathDropRatio: 0.65,
  ijDropRatio: 0.75,
  fsStretchRatio: 0.85,
};

type SimParams = {
  simTime: number;
  attackSeed: number;
  splitPathDropRatio: number;
  ijDropRatio: number;
  fsStretchRatio: number;
  attackers: Record<AttackCategory, number[]>;
};

function badRequest(message: string) {
  return new Response(`${message}\n`, {
    status: 400,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function parseRatio(value: unknown, name: string, fallback: number): number {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    throw new Error(`${name} must be a number between 0 and 1`);
  }
  return n;
}

function parseIds(value: unknown, name: string): number[] {
  if (value === undefined || value === null) return [];
  const tokens = Array.isArray(value) ? value : String(value).split(/[\s,]+/);
  const ids = new Set<number>();
  for (const token of tokens) {
    const s = String(token).trim();
    if (!s) continue;
    const n = Number(s);
    if (!Number.isInteger(n) || n < MIN_NODE_ID || n > MAX_NODE_ID) {
      throw new Error(
        `${name}: "${s}" is not an integer between ${MIN_NODE_ID} and ${MAX_NODE_ID}`,
      );
    }
    ids.add(n);
  }
  return [...ids].sort((a, b) => a - b);
}

function parsePercent(value: unknown, name: string): number {
  if (value === undefined || value === null || value === "") return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new Error(`${name} percentage must be between 0 and 100`);
  }
  return n;
}

// Small deterministic PRNG so the same seed always picks the same nodes.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Turn per-category percentages into concrete, mutually exclusive node-ID lists.
 * The full node pool (vehicles + RSUs) is shuffled once with the seed, then each
 * category takes its slice off the front — so no node is ever assigned twice.
 */
function resolvePercentages(
  percentages: Record<AttackCategory, number>,
  seed: number,
): Record<AttackCategory, number[]> {
  const pool: number[] = [];
  for (let id = MIN_NODE_ID; id <= MAX_NODE_ID; id++) pool.push(id);

  const rng = mulberry32(seed);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const total = pool.length;
  const totalPercent = ATTACK_CATEGORIES.reduce((sum, c) => sum + percentages[c], 0);
  if (totalPercent > 100) {
    throw new Error(
      `attacker percentages add up to ${totalPercent}%, which exceeds 100% (nodes cannot overlap)`,
    );
  }

  const result: Record<AttackCategory, number[]> = {
    split_path: [],
    interleaved_jamming: [],
    flow_stretching: [],
    asymmetric_spoofing: [],
  };

  let cursor = 0;
  for (const cat of ATTACK_CATEGORIES) {
    const count = Math.min(Math.round((percentages[cat] / 100) * total), total - cursor);
    result[cat] = pool.slice(cursor, cursor + count).sort((a, b) => a - b);
    cursor += count;
  }
  return result;
}

function parseParams(body: Record<string, unknown>): SimParams {
  const simTimeRaw = body.simTime;
  const simTime =
    simTimeRaw === undefined || simTimeRaw === "" ? DEFAULTS.simTime : Number(simTimeRaw);
  if (!Number.isFinite(simTime) || simTime <= 0) {
    throw new Error("simTime must be a positive number");
  }

  const seedRaw = body.attackSeed;
  const attackSeed =
    seedRaw === undefined || seedRaw === "" ? DEFAULTS.attackSeed : Number(seedRaw);
  if (!Number.isInteger(attackSeed)) {
    throw new Error("attack_seed must be an integer");
  }

  const mode = body.attackerMode === "percentage" ? "percentage" : "ids";
  let attackers: Record<AttackCategory, number[]>;

  if (mode === "percentage") {
    const raw = (body.attackerPercentages ?? {}) as Record<string, unknown>;
    attackers = resolvePercentages(
      {
        split_path: parsePercent(raw.split_path, "split_path"),
        interleaved_jamming: parsePercent(raw.interleaved_jamming, "interleaved_jamming"),
        flow_stretching: parsePercent(raw.flow_stretching, "flow_stretching"),
        asymmetric_spoofing: parsePercent(raw.asymmetric_spoofing, "asymmetric_spoofing"),
      },
      attackSeed,
    );
  } else {
    const raw = (body.attackers ?? {}) as Record<string, unknown>;
    attackers = {
      split_path: parseIds(raw.split_path, "split_path"),
      interleaved_jamming: parseIds(raw.interleaved_jamming, "interleaved_jamming"),
      flow_stretching: parseIds(raw.flow_stretching, "flow_stretching"),
      asymmetric_spoofing: parseIds(raw.asymmetric_spoofing, "asymmetric_spoofing"),
    };
  }

  return {
    simTime,
    attackSeed,
    splitPathDropRatio: parseRatio(
      body.splitPathDropRatio,
      "split_path_drop_ratio",
      DEFAULTS.splitPathDropRatio,
    ),
    ijDropRatio: parseRatio(body.ijDropRatio, "ij_drop_ratio", DEFAULTS.ijDropRatio),
    fsStretchRatio: parseRatio(body.fsStretchRatio, "fs_stretch_ratio", DEFAULTS.fsStretchRatio),
    attackers,
  };
}

function buildCommand(p: SimParams): string {
  const parts = ["./waf --run 'scratch/auto", `--simTime=${p.simTime}`];

  const active = ATTACK_CATEGORIES.filter((c) => p.attackers[c].length > 0);
  if (active.length > 0) {
    const inner = active.map((c) => `${c}=[${p.attackers[c].join(",")}]`).join(",");
    parts.push(`--enable_attackers="{${inner}}"`);
  }

  parts.push(
    `--split_path_drop_ratio=${p.splitPathDropRatio}`,
    `--ij_drop_ratio=${p.ijDropRatio}`,
    `--fs_stretch_ratio=${p.fsStretchRatio}`,
    `--attack_seed=${p.attackSeed}'`,
  );

  return parts.join(" ");
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  if (req.headers.get("content-type")?.includes("application/json")) {
    try {
      body = ((await req.json()) as Record<string, unknown>) ?? {};
    } catch {
      return badRequest("Invalid JSON body");
    }
  }

  let params: SimParams;
  try {
    params = parseParams(body);
  } catch (err) {
    return badRequest((err as Error).message);
  }

  const simCommand = buildCommand(params);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (text: string) => {
        if (!closed) controller.enqueue(encoder.encode(text));
      };
      const end = () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      };

      send(`cwd: ${NS3_DIR}\n$ ${simCommand}\n\n`);

      const child = spawn(simCommand, {
        cwd: NS3_DIR,
        shell: true,
        env: process.env,
      });

      child.stdout.on("data", (chunk: Buffer) => send(chunk.toString()));
      child.stderr.on("data", (chunk: Buffer) => send(chunk.toString()));

      child.on("error", (err) => {
        send(`\n[failed to start process] ${err.message}\n`);
        end();
      });

      child.on("close", (code, signal) => {
        send(
          signal
            ? `\n[process terminated by signal ${signal}]\n`
            : `\n[process exited with code ${code}]\n`,
        );
        end();
      });

      // Kill the simulation if the client disconnects / aborts the request.
      req.signal.addEventListener("abort", () => {
        child.kill("SIGTERM");
        send("\n[client aborted — sent SIGTERM]\n");
        end();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
      // Concrete node IDs the server assigned to each attack type (after
      // resolving any percentages), so the UI can display them.
      "X-Resolved-Attackers": JSON.stringify(params.attackers),
    },
  });
}
