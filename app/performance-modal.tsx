"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AttackTypeLabel, MccRow, MccTableResponse } from "@/types/mcc";

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

type Props = { open: boolean; onClose: () => void };

const NUM_COL = "px-3 py-2 text-right font-mono tabular-nums";

export default function PerformanceModal({ open, onClose }: Props) {
  const [rows, setRows] = useState<MccRow[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [phase, setPhase] = useState<"loading" | "waiting" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const hadDataRef = useRef(false);

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

    async function poll() {
      try {
        const res = await fetch("/api/mcc", { cache: "no-store", signal: controller.signal });
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
  }, [open]);

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
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-black/[.08] bg-white shadow-2xl dark:border-white/[.12] dark:bg-zinc-900">
        <header className="flex items-center justify-between border-b border-black/[.08] px-5 py-4 dark:border-white/[.1]">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-semibold">Detection performance</h2>
            <span className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              {updatedAt ? relativeTime(updatedAt, now) : "live · polls every 10s"}
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

        <div className="overflow-auto p-5">
          {rows ? (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  <th className="px-3 py-2 text-left font-medium">Attack Type</th>
                  <th className="px-3 py-2 text-right font-medium">TP</th>
                  <th className="px-3 py-2 text-right font-medium">FP</th>
                  <th className="px-3 py-2 text-right font-medium">TN</th>
                  <th className="px-3 py-2 text-right font-medium">FN</th>
                  <th className="px-3 py-2 text-right font-medium">MCC</th>
                  <th className="px-3 py-2 text-right font-medium">Avg TP Latency</th>
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
                      <td className="px-3 py-2 text-left">{DISPLAY_LABELS[r.attackType]}</td>
                      <td className={NUM_COL}>{r.tp}</td>
                      <td className={NUM_COL}>{r.fp}</td>
                      <td className={NUM_COL}>{r.tn}</td>
                      <td className={NUM_COL}>{r.fn}</td>
                      <td className={`${NUM_COL} font-semibold`} style={{ color: mccColor(r.mcc) }}>
                        {r.mcc.toFixed(4)}
                      </td>
                      <td className={NUM_COL}>
                        {r.avgTpLatency === null ? (
                          <span className="text-zinc-400 dark:text-zinc-600">—</span>
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
            <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
          )}
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
