"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LogModal from "./log-modal";

type Props = {
  /** Reset target sent to the API (must match an allow-listed script). */
  target: "lightweight" | "drl";
  /** Button label. */
  label: string;
  /** Title shown on the log modal. */
  logTitle?: string;
  /** Blocked by another long-running task on the page. */
  disabled?: boolean;
  /** Notifies the parent whenever this reset script starts or stops. */
  onRunningChange?: (running: boolean) => void;
};

export default function ResetButton({
  target,
  label,
  logTitle = "Reset script output",
  disabled = false,
  onRunningChange,
}: Props) {
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const closeLogs = useCallback(() => setLogsOpen(false), []);

  useEffect(() => {
    onRunningChange?.(running);
  }, [running, onRunningChange]);

  async function runReset() {
    if (running || disabled) return;

    setRunning(true);
    setError(null);
    setOutput("");
    setLogsOpen(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "");
        throw new Error(detail.trim() || `Request failed with status ${res.status}`);
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

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={runReset}
          disabled={running || disabled}
          className="flex h-11 items-center justify-center rounded-full border border-solid border-black/[.12] px-5 text-sm font-medium transition-colors hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/[.16] dark:hover:bg-[#1a1a1a]"
        >
          {running ? "Resetting…" : label}
        </button>
        {(running || output) && (
          <button
            type="button"
            onClick={() => setLogsOpen(true)}
            disabled={disabled}
            className="flex h-11 items-center gap-2 rounded-full border border-solid border-black/[.12] px-5 text-sm font-medium transition-colors hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/[.16] dark:hover:bg-[#1a1a1a]"
          >
            {running && <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />}
            View logs
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">Error: {error}</p>
      )}

      <LogModal
        open={logsOpen}
        onClose={closeLogs}
        text={output}
        running={running}
        onStop={stop}
        title={logTitle}
      />
    </div>
  );
}
