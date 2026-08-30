"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export const MIN_NODE_ID = 1;
export const MAX_NODE_ID = 321;
// Node IDs 1–200 are vehicles, 201–321 are RSUs.
export const VEHICLE_MAX_ID = 200;
export const TOTAL_NODES = MAX_NODE_ID - MIN_NODE_ID + 1;

export const ATTACK_CATEGORIES = [
  { key: "split_path", label: "Split path", swatch: "bg-sky-500" },
  { key: "interleaved_jamming", label: "Interleaved jamming", swatch: "bg-amber-500" },
  { key: "flow_stretching", label: "Flow stretching", swatch: "bg-violet-500" },
  { key: "asymmetric_spoofing", label: "Asymmetric spoofing", swatch: "bg-rose-500" },
] as const;

export type AttackKey = (typeof ATTACK_CATEGORIES)[number]["key"];
export type AttackerMap = Record<AttackKey, number[]>;
export type AttackerPercentages = Record<AttackKey, number>;
export type AttackerMode = "ids" | "percentage";

export const EMPTY_ATTACKERS: AttackerMap = {
  split_path: [],
  interleaved_jamming: [],
  flow_stretching: [],
  asymmetric_spoofing: [],
};

export const EMPTY_PERCENTAGES: AttackerPercentages = {
  split_path: 0,
  interleaved_jamming: 0,
  flow_stretching: 0,
  asymmetric_spoofing: 0,
};

const CATEGORY_BY_KEY = Object.fromEntries(
  ATTACK_CATEGORIES.map((c) => [c.key, c]),
) as Record<AttackKey, (typeof ATTACK_CATEGORIES)[number]>;

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => i + from);

const NODE_GROUPS = [
  { label: "Vehicles", ids: range(MIN_NODE_ID, VEHICLE_MAX_ID) },
  { label: "RSUs", ids: range(VEHICLE_MAX_ID + 1, MAX_NODE_ID) },
] as const;

type Props = {
  open: boolean;
  mode: AttackerMode;
  onModeChange: (mode: AttackerMode) => void;
  value: AttackerMap;
  onChange: (next: AttackerMap) => void;
  percentages: AttackerPercentages;
  onPercentagesChange: (next: AttackerPercentages) => void;
  onClose: () => void;
};

export default function AttackerNodeModal({
  open,
  mode,
  onModeChange,
  value,
  onChange,
  percentages,
  onPercentagesChange,
  onClose,
}: Props) {
  const [active, setActive] = useState<AttackKey>("split_path");

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

  if (!open) return null;

  const assignment = new Map<number, AttackKey>();
  for (const cat of ATTACK_CATEGORIES) {
    for (const id of value[cat.key]) assignment.set(id, cat.key);
  }
  const totalNodes = assignment.size;
  const totalPercent = ATTACK_CATEGORIES.reduce((sum, c) => sum + percentages[c.key], 0);

  function toggle(id: number) {
    const next: AttackerMap = {
      split_path: value.split_path.filter((n) => n !== id),
      interleaved_jamming: value.interleaved_jamming.filter((n) => n !== id),
      flow_stretching: value.flow_stretching.filter((n) => n !== id),
      asymmetric_spoofing: value.asymmetric_spoofing.filter((n) => n !== id),
    };
    // Re-add to the active category unless it was already there (that's a toggle-off).
    if (assignment.get(id) !== active) {
      next[active] = [...next[active], id].sort((a, b) => a - b);
    }
    onChange(next);
  }

  function setPercent(key: AttackKey, raw: string) {
    const n = raw === "" ? 0 : Number(raw);
    if (!Number.isFinite(n)) return;
    onPercentagesChange({ ...percentages, [key]: Math.max(0, Math.min(100, n)) });
  }

  const tabClass = (selected: boolean) =>
    `flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
      selected
        ? "bg-white shadow-sm dark:bg-zinc-800"
        : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
    }`;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Select attacker nodes"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/50"
      />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-black/[.08] bg-white shadow-2xl dark:border-white/[.12] dark:bg-zinc-900">
        <header className="flex items-center justify-between border-b border-black/[.08] px-5 py-4 dark:border-white/[.1]">
          <h2 className="text-sm font-semibold">Select attacker nodes</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-lg leading-none text-zinc-500 hover:bg-black/[.05] dark:hover:bg-white/[.08]"
          >
            ×
          </button>
        </header>

        <div className="flex gap-1 border-b border-black/[.08] bg-black/[.03] p-1.5 dark:border-white/[.1] dark:bg-white/[.04]">
          <button
            type="button"
            onClick={() => onModeChange("ids")}
            className={tabClass(mode === "ids")}
          >
            Select by node IDs
          </button>
          <button
            type="button"
            onClick={() => onModeChange("percentage")}
            className={tabClass(mode === "percentage")}
          >
            Select by percentage
          </button>
        </div>

        {mode === "ids" ? (
          <>
            <div className="flex flex-col gap-2 border-b border-black/[.08] px-5 py-3 dark:border-white/[.1]">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Pick a category, then click node IDs to assign them. Each node belongs to one
                category at most.
              </p>
              <div className="flex flex-wrap gap-2">
                {ATTACK_CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setActive(c.key)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      active === c.key
                        ? "bg-black/[.08] dark:bg-white/[.12]"
                        : "hover:bg-black/[.04] dark:hover:bg-white/[.06]"
                    }`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${c.swatch}`} />
                    {c.label}
                    <span className="text-zinc-400 dark:text-zinc-500">{value[c.key].length}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-5 overflow-y-auto p-5">
              {NODE_GROUPS.map((group) => (
                <div key={group.label} className="flex flex-col gap-2">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {group.label}
                    </h3>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                      IDs {group.ids[0]}–{group.ids[group.ids.length - 1]}
                    </span>
                  </div>
                  <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-12">
                    {group.ids.map((id) => {
                      const cat = assignment.get(id);
                      const meta = cat ? CATEGORY_BY_KEY[cat] : null;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => toggle(id)}
                          title={meta ? meta.label : "Unassigned"}
                          className={`aspect-square rounded-md text-[11px] font-medium tabular-nums transition-colors ${
                            meta
                              ? `${meta.swatch} text-white`
                              : "bg-black/[.04] text-zinc-600 hover:bg-black/[.09] dark:bg-white/[.06] dark:text-zinc-300 dark:hover:bg-white/[.12]"
                          }`}
                        >
                          {id}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-4 overflow-y-auto p-5">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Give each attack type a share of the {TOTAL_NODES} nodes (vehicles + RSUs). On run,
              the server picks that many distinct nodes at random (seeded by the attack seed) and
              assigns them — a node is never given to two attack types. The shares must total{" "}
              <span className="font-medium">100% or less</span>.
            </p>

            <div className="flex flex-col gap-3">
              {ATTACK_CATEGORIES.map((c) => {
                const pct = percentages[c.key];
                return (
                  <div key={c.key} className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${c.swatch}`} />
                    <span className="flex-1 text-sm">{c.label}</span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      ≈ {Math.round((pct / 100) * TOTAL_NODES)} nodes
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={pct === 0 ? "" : String(pct)}
                      placeholder="0"
                      onChange={(e) => setPercent(c.key, e.target.value)}
                      className="h-9 w-20 rounded-md border border-black/[.12] bg-transparent px-2 text-right text-sm outline-none focus:border-sky-500 dark:border-white/[.16]"
                    />
                    <span className="w-4 text-sm text-zinc-400">%</span>
                  </div>
                );
              })}
            </div>

            <p
              className={`text-xs font-medium ${
                totalPercent > 100
                  ? "text-red-600 dark:text-red-400"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              Total: {totalPercent}%
              {totalPercent > 100 ? " — must be 100% or less" : ` (≈ ${Math.round((Math.min(totalPercent, 100) / 100) * TOTAL_NODES)} of ${TOTAL_NODES} nodes)`}
            </p>
          </div>
        )}

        <footer className="flex items-center justify-between gap-3 border-t border-black/[.08] px-5 py-3 dark:border-white/[.1]">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {mode === "ids"
              ? `${totalNodes} node${totalNodes === 1 ? "" : "s"} selected`
              : `${totalPercent}% allocated`}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                mode === "ids" ? onChange(EMPTY_ATTACKERS) : onPercentagesChange(EMPTY_PERCENTAGES)
              }
              disabled={mode === "ids" ? totalNodes === 0 : totalPercent === 0}
              className="rounded-full border border-black/[.12] px-4 py-1.5 text-xs font-medium transition-colors hover:bg-black/[.04] disabled:opacity-50 dark:border-white/[.16] dark:hover:bg-white/[.06]"
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              Done
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
