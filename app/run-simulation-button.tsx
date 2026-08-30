"use client";

import { useEffect, useRef, useState } from "react";

export default function RunSimulationButton() {
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    // Keep the log scrolled to the bottom as new output streams in.
    preRef.current?.scrollTo({ top: preRef.current.scrollHeight });
  }, [output]);

  async function run() {
    setRunning(true);
    setError(null);
    setOutput("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/run-simulation", {
        method: "POST",
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Request failed with status ${res.status}`);
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
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-base font-medium text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-[#ccc]"
        >
          {running ? "Running simulation…" : "Run ns-3 simulation"}
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
      </div>

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Runs <code className="font-mono">./waf --run &apos;scratch/auto …&apos;</code> on the server
        (working dir: <code className="font-mono">/home/chamod/ns-allinone-3.35/ns-3.35</code>).
      </p>

      {error && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">Error: {error}</p>
      )}

      {(output || running) && (
        <pre
          ref={preRef}
          className="max-h-96 w-full overflow-auto rounded-lg bg-black/[.85] p-4 font-mono text-xs leading-5 text-zinc-100 whitespace-pre-wrap"
        >
          {output || "Waiting for output…"}
        </pre>
      )}
    </div>
  );
}
