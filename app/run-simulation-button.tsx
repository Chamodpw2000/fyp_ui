"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LogModal from "./log-modal";
import PerformanceModal from "./performance-modal";
import AttackerNodeModal, {
  ATTACK_CATEGORIES,
  EMPTY_ATTACKERS,
  EMPTY_PERCENTAGES,
  TOTAL_NODES,
  type AttackerMap,
  type AttackerMode,
  type AttackerPercentages,
} from "./attacker-node-modal";

const DEFAULTS = {
  simTime: "300",
  attackSeed: "12345",
  splitPathDropRatio: "0.65",
  ijDropRatio: "0.75",
  fsStretchRatio: "0.85",
};

const fieldClass =
  "h-10 rounded-md border border-black/[.12] bg-transparent px-3 text-sm outline-none focus:border-sky-500 dark:border-white/[.16]";

/** Which reset was last run — decides the simulation flavour, or `null` if none yet. */
export type SimulationMode = "lightweight" | "drl" | null;

const MODE_LABELS: Record<"lightweight" | "drl", string> = {
  lightweight: "LW mode",
  drl: "DRL mode",
};

type Props = {
  /** Set by the last completed reset; gates and labels the run button. */
  mode?: SimulationMode;
  /** Blocked by another long-running task on the page (e.g. the reset script). */
  disabled?: boolean;
  /** Notifies the parent whenever the simulation starts or stops. */
  onRunningChange?: (running: boolean) => void;
};

export default function RunSimulationButton({
  mode = null,
  disabled = false,
  onRunningChange,
}: Props) {
  const [simTime, setSimTime] = useState(DEFAULTS.simTime);
  const [attackSeed, setAttackSeed] = useState(DEFAULTS.attackSeed);
  const [splitPathDropRatio, setSplitPathDropRatio] = useState(DEFAULTS.splitPathDropRatio);
  const [ijDropRatio, setIjDropRatio] = useState(DEFAULTS.ijDropRatio);
  const [fsStretchRatio, setFsStretchRatio] = useState(DEFAULTS.fsStretchRatio);

  const [attackerMode, setAttackerMode] = useState<AttackerMode>("ids");
  const [attackers, setAttackers] = useState<AttackerMap>(EMPTY_ATTACKERS);
  const [attackerPercentages, setAttackerPercentages] =
    useState<AttackerPercentages>(EMPTY_PERCENTAGES);
  const [modalOpen, setModalOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [perfOpen, setPerfOpen] = useState(false);

  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resolvedAttackers, setResolvedAttackers] = useState<AttackerMap | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const closeModal = useCallback(() => setModalOpen(false), []);
  const closeLogs = useCallback(() => setLogsOpen(false), []);
  const closePerf = useCallback(() => setPerfOpen(false), []);

  useEffect(() => {
    onRunningChange?.(running);
  }, [running, onRunningChange]);

  const totalIdAttackers = ATTACK_CATEGORIES.reduce((sum, c) => sum + attackers[c.key].length, 0);
  const totalPercent = ATTACK_CATEGORIES.reduce((sum, c) => sum + attackerPercentages[c.key], 0);
  const hasAttackers = attackerMode === "ids" ? totalIdAttackers > 0 : totalPercent > 0;
  const percentInvalid = attackerMode === "percentage" && totalPercent > 100;
  // Any control that should be inert while this run — or the reset script — is active.
  const controlsDisabled = running || disabled;
  // The run button needs a completed reset to know which mode to simulate.
  const runLabel = running
    ? "Running simulation…"
    : mode
      ? `Run ns-3 simulation with ${MODE_LABELS[mode]}`
      : "Run ns-3 simulation";

  async function run() {
    if (percentInvalid) return;
    setRunning(true);
    setError(null);
    setOutput("");
    setResolvedAttackers(null);
    setLogsOpen(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/run-simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simTime,
          attackSeed,
          splitPathDropRatio,
          ijDropRatio,
          fsStretchRatio,
          attackerMode,
          attackers,
          attackerPercentages,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "");
        throw new Error(detail.trim() || `Request failed with status ${res.status}`);
      }

      const resolvedHeader = res.headers.get("X-Resolved-Attackers");
      if (resolvedHeader) {
        try {
          setResolvedAttackers(JSON.parse(resolvedHeader) as AttackerMap);
        } catch {
          // leave the resolved panel hidden if the header is malformed
        }
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setOutput((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message);
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function reset() {
    setSimTime(DEFAULTS.simTime);
    setAttackSeed(DEFAULTS.attackSeed);
    setSplitPathDropRatio(DEFAULTS.splitPathDropRatio);
    setIjDropRatio(DEFAULTS.ijDropRatio);
    setFsStretchRatio(DEFAULTS.fsStretchRatio);
    setAttackerMode("ids");
    setResolvedAttackers(null);
    setAttackers(EMPTY_ATTACKERS);
    setAttackerPercentages(EMPTY_PERCENTAGES);
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-xl border border-black/[.08] p-4 dark:border-white/[.1]">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Simulation parameters</h2>
          <button
            type="button"
            onClick={reset}
            disabled={controlsDisabled}
            className="text-xs font-medium text-sky-600 hover:underline disabled:opacity-50 dark:text-sky-400"
          >
            Reset to defaults
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Simulation time (s)
            </span>
            <input
              type="number"
              min="1"
              value={simTime}
              onChange={(e) => setSimTime(e.target.value)}
              disabled={controlsDisabled}
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Attack seed</span>
            <input
              type="number"
              step="1"
              value={attackSeed}
              onChange={(e) => setAttackSeed(e.target.value)}
              disabled={controlsDisabled}
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Split Path Attack Drop Ratio
            </span>
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={splitPathDropRatio}
              onChange={(e) => setSplitPathDropRatio(e.target.value)}
              disabled={controlsDisabled}
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Interleaved Grayhole Attack Drop Ratio
            </span>
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={ijDropRatio}
              onChange={(e) => setIjDropRatio(e.target.value)}
              disabled={controlsDisabled}
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Flow Stretching Attack Stretch Ratio
            </span>
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={fsStretchRatio}
              onChange={(e) => setFsStretchRatio(e.target.value)}
              disabled={controlsDisabled}
              className={fieldClass}
            />
          </label>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Attacker nodes
            </span>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              disabled={controlsDisabled}
              className="rounded-full border border-black/[.12] px-4 py-1.5 text-xs font-medium transition-colors hover:bg-black/[.04] disabled:opacity-50 dark:border-white/[.16] dark:hover:bg-white/[.06]"
            >
              {hasAttackers ? "Edit attacker nodes" : "Select attacker nodes"}
            </button>
          </div>

          {!hasAttackers && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              No attacker nodes selected (default).
            </p>
          )}

          {percentInvalid && (
            <p className="text-xs font-medium text-red-600 dark:text-red-400">
              Attacker percentages add up to {totalPercent}% — must be 100% or less before you can
              run the simulation.
            </p>
          )}

          {hasAttackers && attackerMode === "ids" && (
            <ul className="flex flex-col gap-1.5">
              {ATTACK_CATEGORIES.filter((c) => attackers[c.key].length > 0).map((c) => (
                <li key={c.key} className="flex items-start gap-2 text-xs">
                  <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${c.swatch}`} />
                  <span className="font-medium text-zinc-600 dark:text-zinc-300">{c.label}:</span>
                  <span className="font-mono text-zinc-500 dark:text-zinc-400">
                    {attackers[c.key].join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {hasAttackers && attackerMode === "percentage" && (
            <ul className="flex flex-col gap-1.5">
              {ATTACK_CATEGORIES.filter((c) => attackerPercentages[c.key] > 0).map((c) => (
                <li key={c.key} className="flex items-center gap-2 text-xs">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${c.swatch}`} />
                  <span className="font-medium text-zinc-600 dark:text-zinc-300">{c.label}:</span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {attackerPercentages[c.key]}% (≈{" "}
                    {Math.round((attackerPercentages[c.key] / 100) * TOTAL_NODES)} nodes, resolved on
                    the server)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={run}
          disabled={controlsDisabled || percentInvalid || !mode}
          title={
            !mode
              ? "Run a reset (light-weight or DRL agent mode) first"
              : percentInvalid
                ? "Attacker percentages exceed 100%"
                : undefined
          }
          className="flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-base font-medium text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-[#ccc]"
        >
          {runLabel}
        </button>
        <button
          type="button"
          onClick={() => setPerfOpen(true)}
          disabled={disabled || !mode}
          className="flex h-12 items-center justify-center rounded-full border border-solid border-black/[.12] px-6 text-base font-medium transition-colors hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/[.16] dark:hover:bg-[#1a1a1a]"
        >
          Show performance
        </button>
        {running && (
          <button
            type="button"
            onClick={stop}
            className="flex h-12 items-center justify-center rounded-full border border-solid border-black/[.12] px-6 text-base font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.16] dark:hover:bg-[#1a1a1a]"
          >
            Stop
          </button>
        )}
        {(running || output) && (
          <button
            type="button"
            onClick={() => setLogsOpen(true)}
            disabled={disabled}
            className="flex h-12 items-center gap-2 rounded-full border border-solid border-black/[.12] px-6 text-base font-medium transition-colors hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/[.16] dark:hover:bg-[#1a1a1a]"
          >
            {running && (
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            )}
            View logs
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">Error: {error}</p>
      )}

      {resolvedAttackers &&
        ATTACK_CATEGORIES.some((c) => resolvedAttackers[c.key].length > 0) && (
          <div className="flex flex-col gap-2 rounded-lg border border-black/[.08] p-4 dark:border-white/[.1]">
            <span className="text-xs font-semibold">Resolved attacker nodes (from server)</span>
            <ul className="flex flex-col gap-1.5">
              {ATTACK_CATEGORIES.filter((c) => resolvedAttackers[c.key].length > 0).map((c) => (
                <li key={c.key} className="flex flex-col gap-0.5 text-xs">
                  <span className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${c.swatch}`} />
                    <span className="font-medium text-zinc-600 dark:text-zinc-300">{c.label}</span>
                    <span className="text-zinc-400 dark:text-zinc-500">
                      ({resolvedAttackers[c.key].length} nodes)
                    </span>
                  </span>
                  <span className="font-mono break-words pl-4 text-zinc-500 dark:text-zinc-400">
                    {resolvedAttackers[c.key].join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

      <LogModal
        open={logsOpen}
        onClose={closeLogs}
        text={output}
        running={running}
        onStop={stop}
      />

      <PerformanceModal open={perfOpen} onClose={closePerf} mode={mode} />

      <AttackerNodeModal
        open={modalOpen}
        mode={attackerMode}
        onModeChange={setAttackerMode}
        value={attackers}
        onChange={setAttackers}
        percentages={attackerPercentages}
        onPercentagesChange={setAttackerPercentages}
        onClose={closeModal}
      />
    </div>
  );
}
