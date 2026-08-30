"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  text: string;
  running: boolean;
  onStop?: () => void;
  title?: string;
};

export default function LogModal({
  open,
  onClose,
  text,
  running,
  onStop,
  title = "Simulation logs",
}: Props) {
  const preRef = useRef<HTMLPreElement | null>(null);
  // Whether the view is pinned to the bottom (auto-follow new output).
  const stickToBottom = useRef(true);

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
    const el = preRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [open, text]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Simulation logs"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/50"
      />
      <div className="relative z-10 flex h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-black/[.08] bg-white shadow-2xl dark:border-white/[.12] dark:bg-zinc-900">
        <header className="flex items-center justify-between border-b border-black/[.08] px-5 py-4 dark:border-white/[.1]">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">{title}</h2>
            <span
              className={`flex items-center gap-1.5 text-xs ${
                running ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  running ? "animate-pulse bg-emerald-500" : "bg-zinc-400"
                }`}
              />
              {running ? "Running" : "Finished"}
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

        <pre
          ref={preRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          }}
          className="flex-1 overflow-auto bg-black/[.88] p-4 font-mono text-xs leading-5 text-zinc-100 whitespace-pre-wrap"
        >
          {text || "Waiting for output…"}
        </pre>

        <footer className="flex items-center justify-end gap-2 border-t border-black/[.08] px-5 py-3 dark:border-white/[.1]">
          {running && onStop && (
            <button
              type="button"
              onClick={onStop}
              className="rounded-full border border-black/[.12] px-4 py-1.5 text-xs font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.16] dark:hover:bg-white/[.06]"
            >
              Stop simulation
            </button>
          )}
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
