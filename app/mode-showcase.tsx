"use client";

import type { SimulationMode } from "./run-simulation-button";

type Props = {
  mode: SimulationMode;
};

/**
 * Mode-aware decorative banner shown once a reset has picked the mitigation
 * strategy. Purely aesthetic abstract artwork — no technical diagrams.
 */
export default function ModeShowcase({ mode }: Props) {
  if (!mode) return null;

  const meta =
    mode === "lightweight"
      ? {
          badge: "LW",
          badgeClass:
            "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
          title: "Light-weight mode",
          kind: "Rule-based mitigation system",
          chips: [
            "Fixed thresholds",
            "Deterministic verdicts",
            "Microsecond decisions",
          ],
          chipClass:
            "border-emerald-200 text-emerald-700 dark:border-emerald-500/25 dark:text-emerald-300",
        }
      : {
          badge: "DRL",
          badgeClass:
            "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
          title: "DRL agent mode",
          kind: "Deep Reinforcement Learning agent",
          chips: ["Learned policy", "Reward-driven", "Adapts online"],
          chipClass:
            "border-violet-200 text-violet-700 dark:border-violet-500/25 dark:text-violet-300",
        };

  return (
    <section
      key={mode}
      className="ms-card flex flex-col gap-4 overflow-hidden rounded-xl border border-black/[.08] p-5 dark:border-white/[.1]"
    >
      <div className="relative aspect-[8/3] w-full overflow-hidden rounded-lg">
        {mode === "lightweight" ? <CurrentsArt /> : <BloomArt />}
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 bg-linear-to-t from-black/45 to-transparent p-4">
          <span
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold tracking-tight ${meta.badgeClass}`}
          >
            {meta.badge}
          </span>
          <div className="flex flex-col">
            <h2 className="text-sm font-semibold text-white drop-shadow">
              {meta.title}
            </h2>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/75">
              {meta.kind}
            </p>
          </div>
        </div>
      </div>

      <ul className="flex flex-wrap gap-2">
        {meta.chips.map((chip) => (
          <li
            key={chip}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${meta.chipClass}`}
          >
            {chip}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Light-weight mode — calm flowing currents                           */
/* ------------------------------------------------------------------ */

function CurrentsArt() {
  return (
    <svg
      viewBox="0 0 400 150"
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="lw-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ecfdf5" />
          <stop offset="0.55" stopColor="#d1fae5" />
          <stop offset="1" stopColor="#cffafe" />
        </linearGradient>
        <linearGradient id="lw-bg-dark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#022c22" />
          <stop offset="1" stopColor="#083344" />
        </linearGradient>
        <filter id="lw-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
      </defs>

      <rect
        width="400"
        height="150"
        fill="url(#lw-bg)"
        className="dark:hidden"
      />
      <rect
        width="400"
        height="150"
        fill="url(#lw-bg-dark)"
        className="hidden dark:block"
      />

      {/* soft orbs */}
      <circle
        cx="70"
        cy="40"
        r="34"
        fill="#34d399"
        opacity="0.45"
        filter="url(#lw-soft)"
        className="ms-float"
      />
      <circle
        cx="330"
        cy="55"
        r="42"
        fill="#22d3ee"
        opacity="0.4"
        filter="url(#lw-soft)"
        className="ms-float"
        style={{ animationDelay: "1.6s" }}
      />
      <circle
        cx="210"
        cy="20"
        r="24"
        fill="#a7f3d0"
        opacity="0.5"
        filter="url(#lw-soft)"
        className="ms-float"
        style={{ animationDelay: "3s" }}
      />

      {/* drifting currents */}
      <g className="ms-drift">
        <path
          d="M-60 104 C 40 74, 120 132, 220 102 S 400 70, 520 100 L520 170 L-60 170 Z"
          fill="#10b981"
          opacity="0.22"
        />
        <path
          d="M-60 120 C 60 96, 150 148, 260 118 S 420 92, 520 118 L520 170 L-60 170 Z"
          fill="#0ea5e9"
          opacity="0.18"
        />
        <path
          d="M-60 138 C 80 120, 160 160, 280 136 S 440 116, 520 138 L520 170 L-60 170 Z"
          fill="#14b8a6"
          opacity="0.16"
        />
      </g>

      {/* sparkles */}
      <circle cx="120" cy="46" r="2" fill="#ffffff" opacity="0.9" />
      <circle cx="286" cy="34" r="1.6" fill="#ffffff" opacity="0.8" />
      <circle cx="188" cy="66" r="1.4" fill="#ffffff" opacity="0.7" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* DRL agent mode — adaptive bloom                                     */
/* ------------------------------------------------------------------ */

function BloomArt() {
  return (
    <svg
      viewBox="0 0 400 150"
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="drl-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f5f3ff" />
          <stop offset="0.5" stopColor="#ede9fe" />
          <stop offset="1" stopColor="#fae8ff" />
        </linearGradient>
        <linearGradient id="drl-bg-dark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1e1b4b" />
          <stop offset="1" stopColor="#3b0764" />
        </linearGradient>
        <radialGradient id="drl-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#c4b5fd" stopOpacity="0.95" />
          <stop offset="0.6" stopColor="#a855f7" stopOpacity="0.35" />
          <stop offset="1" stopColor="#a855f7" stopOpacity="0" />
        </radialGradient>
        <filter id="drl-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
      </defs>

      <rect
        width="400"
        height="150"
        fill="url(#drl-bg)"
        className="dark:hidden"
      />
      <rect
        width="400"
        height="150"
        fill="url(#drl-bg-dark)"
        className="hidden dark:block"
      />

      {/* floating orbs */}
      <circle
        cx="60"
        cy="110"
        r="40"
        fill="#c084fc"
        opacity="0.4"
        filter="url(#drl-soft)"
        className="ms-float"
      />
      <circle
        cx="350"
        cy="40"
        r="46"
        fill="#f0abfc"
        opacity="0.4"
        filter="url(#drl-soft)"
        className="ms-float"
        style={{ animationDelay: "2s" }}
      />

      {/* concentric rings */}
      <g stroke="#a855f7" fill="none" opacity="0.35">
        <circle cx="200" cy="75" r="46" strokeWidth="1.5" />
        <circle cx="200" cy="75" r="66" strokeWidth="1.2" opacity="0.6" />
        <circle cx="200" cy="75" r="88" strokeWidth="1" opacity="0.4" />
      </g>

      {/* central glow */}
      <circle
        cx="200"
        cy="75"
        r="52"
        fill="url(#drl-glow)"
        className="ms-breathe"
      />

      {/* orbiting tokens */}
      <g style={{ transformOrigin: "200px 75px" }} className="ms-orbit">
        <circle cx="200" cy="9" r="5" fill="#8b5cf6" />
        <circle cx="200" cy="141" r="3.5" fill="#e879f9" />
      </g>
      <g
        style={{
          transformOrigin: "200px 75px",
          animationDuration: "11s",
          animationDirection: "reverse",
        }}
        className="ms-orbit"
      >
        <circle cx="134" cy="75" r="4" fill="#d946ef" />
        <circle cx="266" cy="75" r="3" fill="#c4b5fd" />
      </g>

      {/* sparkles */}
      <circle cx="150" cy="40" r="1.8" fill="#ffffff" opacity="0.85" />
      <circle cx="255" cy="112" r="1.5" fill="#ffffff" opacity="0.8" />
    </svg>
  );
}
