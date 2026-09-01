"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AttackTypeLabel, MccRow, MccTableResponse } from "@/types/mcc";
import type { RemovedNodesResponse } from "@/types/removed-nodes";
import type { SimulationMode } from "./run-simulation-button";
import type { AttackerMap } from "./attacker-node-modal";
import NetworkMap from "./network-map";

const POLL_MS = 10_000;

// Fixed display order, applied client-side (the CSV row order is unstable).
const DISPLAY_ORDER: AttackTypeLabel[] = [
  "Interleaved Jamming",
  "Split Path",
  "Flow Stretching",
  "Asym Link Spoofing",
  "All Attacks (Overall)",
];
const OVERALL: AttackTypeLabel = "All Attacks (Overall)";

// The CSV emits "Interleaved Jamming"; the UI always shows "Interleaved Grayhole".
const DISPLAY_LABELS: Record<AttackTypeLabel, string> = {
  "Split Path": "Split Path",
  "Flow Stretching": "Flow Stretching",
  "Interleaved Jamming": "Interleaved Grayhole",
  "Asym Link Spoofing": "Asym Link Spoofing",
  "All Attacks (Overall)": "All Attacks (Overall)",
};

function rank(attackType: string): number {
  const i = DISPLAY_ORDER.indexOf(attackType as AttackTypeLabel);
  if (i !== -1) return i;
  // Unknown types (shouldn't happen): just before the overall row.
  return DISPLAY_ORDER.length - 1.5;
}

function sortRows(rows: MccRow[]): MccRow[] {
  return [...rows].sort((a, b) => rank(a.attackType) - rank(b.attackType));
}

function mccColor(mcc: number): string {
  // red (<= 0) -> amber -> green (-> 1). Negative values clamp to red.
  const t = Math.max(0, Math.min(1, mcc));
  return `hsl(${Math.round(t * 120)}, 75%, 45%)`;
}

function relativeTime(iso: string, now: number): string {
  const secs = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (secs < 60) return `updated ${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `updated ${mins}m ${secs % 60}s ago`;
  const hrs = Math.floor(mins / 60);
  return `updated ${hrs}h ${mins % 60}m ago`;
}

type Props = {
  open: boolean;
  onClose: () => void;
  mode: SimulationMode;
  /** Attacker node IDs per attack category — drives the map's malicious nodes. */
  attackers: AttackerMap;
};

const NUM_COL = "px-3 py-2 text-right font-mono tabular-nums";

export default function PerformanceModal({
  open,
  onClose,
  mode,
  attackers,
}: Props) {
  const isLw = mode === "lightweight";
  const [rows, setRows] = useState<MccRow[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [phase, setPhase] = useState<"loading" | "waiting" | "error">(
    "loading",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Node IDs pruned by the agent (union of every cycle in removed_nodes.csv).
  const [removed, setRemoved] = useState<ReadonlySet<number>>(() => new Set());
  const [removalAlert, setRemovalAlert] = useState<string | null>(null);

  const hadDataRef = useRef(false);

  // The two modes read from different CSVs — start each from a clean slate.
  useEffect(() => {
    hadDataRef.current = false;
    setRows(null);
    setUpdatedAt(null);
    setPhase("loading");
    setErrorMsg(null);
    setRemoved(new Set());
    setRemovalAlert(null);
  }, [mode]);

  // Auto-dismiss the removal alert.
  useEffect(() => {
    if (!removalAlert) return;
    const t = setTimeout(() => setRemovalAlert(null), 8000);
    return () => clearTimeout(t);
  }, [removalAlert]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const controller = new AbortController();
    setReconnecting(hadDataRef.current);

    const url = mode === "drl" ? "/api/mcc?mode=drl" : "/api/mcc";

    async function poll() {
      try {
        const res = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await res.json()) as MccTableResponse;
        if (cancelled) return;

        if (data.status === "ok") {
          hadDataRef.current = true;
          setRows(sortRows(data.rows));
          setUpdatedAt(data.updatedAt);
          setPhase("loading");
          setErrorMsg(null);
          setReconnecting(false);
        } else if (data.status === "waiting") {
          setReconnecting(false);
          if (!hadDataRef.current) setPhase("waiting");
        } else if (hadDataRef.current) {
          setReconnecting(true);
        } else {
          setPhase("error");
          setErrorMsg(data.message);
        }
      } catch (err) {
        if (cancelled || (err as Error).name === "AbortError") return;
        if (hadDataRef.current) {
          setReconnecting(true);
        } else {
          setPhase("error");
          setErrorMsg((err as Error).message);
        }
      }
    }

    poll();
    const pollId = setInterval(poll, POLL_MS);
    const tickId = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(pollId);
      clearInterval(tickId);
    };
  }, [open, mode]);

  // Removed-nodes feed — same 10s cadence, LW mode only (that's where the map is).
  useEffect(() => {
    if (!open || !isLw) return;

    let cancelled = false;
    let baselined = false; // first fetch adopts existing cycles silently
    let seenCycle = 0;
    const controller = new AbortController();

    async function poll() {
      try {
        const res = await fetch("/api/removed-nodes", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await res.json()) as RemovedNodesResponse;
        if (cancelled || data.status !== "ok") return;

        const all = new Set<number>();
        for (const c of data.cycles) for (const id of c.nodeIds) all.add(id);
        setRemoved(all);

        const maxCycle = data.cycles.reduce(
          (m, c) => Math.max(m, c.cycleId),
          0,
        );
        if (!baselined) {
          baselined = true;
          seenCycle = maxCycle;
          return;
        }

        const fresh = data.cycles.filter((c) => c.cycleId > seenCycle);
        if (fresh.length > 0) {
          seenCycle = maxCycle;
          const ids = fresh.flatMap((c) => c.nodeIds);
          const label =
            fresh.length === 1
              ? `Cycle ${fresh[0].cycleId}`
              : `Cycles ${fresh[0].cycleId}–${fresh[fresh.length - 1].cycleId}`;
          setRemovalAlert(
            `${label}: removed ${ids.length} node${ids.length === 1 ? "" : "s"} — ${ids.join(", ")}`,
          );
        }
      } catch {
        // transient; the next tick will retry
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(id);
    };
  }, [open, isLw]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="System performance"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/50"
      />
      <div
        className={`relative z-10 flex w-full flex-col overflow-hidden rounded-xl border border-black/[.08] bg-white shadow-2xl dark:border-white/[.12] dark:bg-zinc-900 ${
          isLw ? "max-h-[92vh] max-w-6xl" : "max-h-[85vh] max-w-2xl"
        }`}
      >
        <header className="flex items-center justify-between border-b border-black/[.08] px-5 py-4 dark:border-white/[.1]">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-semibold">Detection performance</h2>
            <span className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              {updatedAt
                ? relativeTime(updatedAt, now)
                : "live · polls every 10s"}
              {reconnecting && (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                  reconnecting
                </span>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-lg leading-none text-zinc-500 hover:bg-black/[.05] dark:hover:bg-white/[.08]"
          >
            ×
          </button>
        </header>

        <div className="flex flex-col gap-6 overflow-auto p-5">
          {isLw && (
            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3 className="text-sm font-semibold">Network topology</h3>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {removed.size > 0
                    ? `${321 - removed.size} of 321 nodes active · ${removed.size} removed`
                    : "321 nodes · sample movement"}
                </span>
              </div>
              {removalAlert && (
                <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                  <span>⚠ {removalAlert}</span>
                  <button
                    type="button"
                    onClick={() => setRemovalAlert(null)}
                    className="shrink-0 leading-none text-amber-600 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200"
                    aria-label="Dismiss"
                  >
                    ×
                  </button>
                </div>
              )}
              <NetworkMap attackers={attackers} removed={removed} />
            </section>
          )}

          <section className="flex flex-col gap-3">
            {isLw && (
              <h3 className="text-sm font-semibold">Detection metrics</h3>
            )}

            {rows ? (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    <th className="px-3 py-2 text-left font-medium">
                      Attack Type
                    </th>
                    <th className="px-3 py-2 text-right font-medium">TP</th>
                    <th className="px-3 py-2 text-right font-medium">FP</th>
                    <th className="px-3 py-2 text-right font-medium">TN</th>
                    <th className="px-3 py-2 text-right font-medium">FN</th>
                    <th className="px-3 py-2 text-right font-medium">MCC</th>
                    <th className="px-3 py-2 text-right font-medium">
                      Avg TP Latency
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const isOverall = r.attackType === OVERALL;
                    return (
                      <tr
                        key={r.attackType}
                        className={
                          isOverall
                            ? "border-t-2 border-black/20 font-semibold dark:border-white/25"
                            : "border-t border-black/[.06] dark:border-white/[.08]"
                        }
                      >
                        <td className="px-3 py-2 text-left">
                          {DISPLAY_LABELS[r.attackType]}
                        </td>
                        <td className={NUM_COL}>{r.tp}</td>
                        <td className={NUM_COL}>{r.fp}</td>
                        <td className={NUM_COL}>{r.tn}</td>
                        <td className={NUM_COL}>{r.fn}</td>
                        <td
                          className={`${NUM_COL} font-semibold`}
                          style={{ color: mccColor(r.mcc) }}
                        >
                          {r.mcc.toFixed(4)}
                        </td>
                        <td className={NUM_COL}>
                          {r.avgTpLatency === null ? (
                            <span className="text-zinc-400 dark:text-zinc-600">
                              —
                            </span>
                          ) : (
                            r.avgTpLatency.toFixed(2)
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : phase === "waiting" ? (
              <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                Waiting for first detection cycle…
              </p>
            ) : phase === "error" ? (
              <p className="py-8 text-center text-sm font-medium text-red-600 dark:text-red-400">
                {errorMsg ?? "Failed to load performance data."}
              </p>
            ) : (
              <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                Loading…
              </p>
            )}
          </section>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-black/[.08] px-5 py-3 dark:border-white/[.1]">
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            Latency in simulation cycles · MCC ranges −1 to 1
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Close
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
