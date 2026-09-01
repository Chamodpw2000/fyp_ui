"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ATTACK_CATEGORIES,
  EMPTY_ATTACKERS,
  VEHICLE_MAX_ID,
  type AttackKey,
  type AttackerMap,
} from "./attacker-node-modal";

const W = 880;
const H = 520;
const VEHICLE_COUNT = 200;

// Fill + legend colour per attack category (matches the attacker picker swatches).
const CATEGORY_FILL: Record<AttackKey, string> = {
  split_path: "fill-sky-500",
  interleaved_jamming: "fill-amber-500",
  flow_stretching: "fill-violet-500",
  asymmetric_spoofing: "fill-rose-500",
};
const CATEGORY_SWATCH: Record<AttackKey, string> = {
  split_path: "#0ea5e9",
  interleaved_jamming: "#f59e0b",
  flow_stretching: "#8b5cf6",
  asymmetric_spoofing: "#f43f5e",
};
const MALICIOUS_RING = "#ef4444";

const CAT_LABEL = Object.fromEntries(
  ATTACK_CATEGORIES.map((c) => [c.key, c.label]),
) as Record<AttackKey, string>;

function nodeTitle(
  id: number,
  kind: "Vehicle" | "RSU",
  key?: AttackKey,
): string {
  return key
    ? `${kind} ${id} — malicious (${CAT_LABEL[key]})`
    : `${kind} ${id} — benign`;
}

// Small deterministic PRNG so the scene is identical on every render.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pt = [number, number];

/**
 * A closed, organically-wobbling loop — evaluate at t in [0,1). Because it is
 * closed, vehicles circulating on it never jump: the lap just repeats.
 */
function makeLoop(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  amp: number,
  freq: number,
  phase: number,
  rot = 0,
) {
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return (t: number): Pt => {
    const a = t * Math.PI * 2;
    const wob = 1 + (amp / Math.max(rx, ry)) * Math.sin(freq * a + phase);
    let x = Math.cos(a) * rx * wob + Math.sin(a * 2 + phase) * amp * 0.6;
    let y = Math.sin(a) * ry * wob + Math.cos(a * 3 + phase) * amp * 0.6;
    [x, y] = [x * cos - y * sin, x * sin + y * cos];
    return [cx + x, cy + y];
  };
}

function loopPath(fn: (t: number) => Pt, n = 168): string {
  let d = "";
  for (let i = 0; i < n; i++) {
    const [x, y] = fn(i / n);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)} `;
  }
  return `${d}Z`;
}

// RSUs sit just off the kerb, spaced evenly along a circuit.
function rsusOnLoop(
  fn: (t: number) => Pt,
  count: number,
  startId: number,
  offset: number,
) {
  const out: { id: number; x: number; y: number }[] = [];
  for (let k = 0; k < count; k++) {
    const t = (k + 0.5) / count;
    const [x, y] = fn(t);
    const [x2, y2] = fn(t + 1e-3);
    const dx = x2 - x;
    const dy = y2 - y;
    const len = Math.hypot(dx, dy) || 1;
    const side = k % 2 === 0 ? 1 : -1;
    out.push({
      id: startId + k,
      x: x + (-dy / len) * offset * side,
      y: y + (dx / len) * offset * side,
    });
  }
  return out;
}

// An organic, overlapping road network — six circuits, no grid.
const CIRCUITS = [
  { fn: makeLoop(442, 258, 332, 206, 18, 3, 0.0), rsu: 32, offset: 13 },
  { fn: makeLoop(410, 250, 206, 140, 15, 4, 1.1, 0.16), rsu: 24, offset: 12 },
  { fn: makeLoop(476, 176, 236, 96, 16, 5, 0.5, -0.12), rsu: 18, offset: 11 },
  { fn: makeLoop(420, 356, 250, 100, 16, 5, 2.0, 0.08), rsu: 19, offset: 11 },
  { fn: makeLoop(652, 282, 112, 150, 13, 4, 0.8), rsu: 14, offset: 10 },
  { fn: makeLoop(214, 250, 112, 150, 13, 4, 3.0), rsu: 14, offset: 10 },
];

const CIRCUIT_PATHS = CIRCUITS.map((c) => loopPath(c.fn));

// Dense sample of every road centre-line, for keeping scenery off the tarmac.
const ROAD_POINTS: Pt[] = CIRCUITS.flatMap((c) =>
  Array.from({ length: 220 }, (_, i) => c.fn(i / 220)),
);
const ROAD_HALF = 8; // road casing half-width (+ a hair)

function distToRoad(x: number, y: number): number {
  let min = Infinity;
  for (const [px, py] of ROAD_POINTS) {
    const d = (px - x) ** 2 + (py - y) ** 2;
    if (d < min) min = d;
  }
  return Math.sqrt(min);
}

const RSUS = (() => {
  const out: { id: number; x: number; y: number }[] = [];
  let id = VEHICLE_MAX_ID + 1; // 201
  for (const c of CIRCUITS) {
    out.push(...rsusOnLoop(c.fn, c.rsu, id, c.offset));
    id += c.rsu;
  }
  return out; // 121 RSUs, IDs 201..321
})();

// Motion config per vehicle (node IDs 1..200); malicious status comes from props.
const VEHICLES = (() => {
  const rand = mulberry32(20240517);
  return Array.from({ length: VEHICLE_COUNT }, (_, k) => {
    const circuit = Math.floor(rand() * CIRCUITS.length);
    const dur = 22 + rand() * 26;
    return {
      id: k + 1,
      circuit,
      dur,
      begin: -(rand() * dur),
      reverse: rand() < 0.5,
      start: rand(),
      r: 2.6 + rand() * 1.2,
    };
  });
})();

/* ---------------- scenery ---------------- */

const RIVER =
  "M -30,96 C 120,150 205,66 300,118 C 382,162 432,150 472,202 C 522,262 560,250 622,292 C 692,338 782,300 920,332";

// Green space (gets trees); the two big ones also hold a pond.
const PARKS = [
  { x: 60, y: 372, w: 168, h: 122, trees: 12 },
  { x: 672, y: 78, w: 168, h: 122, trees: 12 },
  { x: 355, y: 222, w: 150, h: 78, trees: 9 },
  { x: 52, y: 150, w: 86, h: 150, trees: 7 },
  { x: 738, y: 238, w: 86, h: 160, trees: 7 },
];

const PONDS = [
  "M 95,434 C 82,412 120,400 148,408 C 180,417 196,406 202,432 C 208,460 172,478 140,470 C 110,463 108,456 95,434 Z",
  "M 712,138 C 702,118 740,108 766,116 C 794,125 810,114 816,140 C 822,168 788,186 758,178 C 730,171 722,158 712,138 Z",
];

// Building clusters (blocks of rooftop footprints) in the gaps.
const DISTRICTS = [
  { x: 245, y: 92, w: 150, h: 78 },
  { x: 560, y: 118, w: 150, h: 72 },
  { x: 560, y: 342, w: 150, h: 92 },
  { x: 245, y: 348, w: 118, h: 88 },
];

const B_BODY = [
  "fill-slate-300 dark:fill-slate-700",
  "fill-stone-300 dark:fill-stone-700",
  "fill-zinc-300 dark:fill-zinc-700",
];
const B_ROOF = [
  "fill-slate-400 dark:fill-slate-600",
  "fill-stone-400 dark:fill-stone-600",
  "fill-zinc-400 dark:fill-zinc-600",
];

// Top-down footprint: centre, size, tone, slight yaw.
type Building = {
  cx: number;
  cy: number;
  w: number;
  h: number;
  t: number;
  rot: number;
};

const BUILDINGS: Building[] = (() => {
  const rand = mulberry32(4242);
  const out: Building[] = [];
  for (const d of DISTRICTS) {
    let y = d.y + 4;
    while (y < d.y + d.h - 14) {
      const rowH = 15 + rand() * 15;
      let x = d.x + 4;
      while (x < d.x + d.w - 14) {
        const w = 14 + rand() * 18;
        const cx = x + w / 2;
        const cy = y + rowH / 2;
        const reach = Math.hypot(w / 2, rowH / 2) + 4; // footprint + drop shadow
        if (distToRoad(cx, cy) > ROAD_HALF + reach) {
          out.push({
            cx,
            cy,
            w,
            h: rowH,
            t: Math.floor(rand() * 3),
            rot: (rand() - 0.5) * 10,
          });
        }
        x += w + 4 + rand() * 5;
      }
      y += rowH + 4 + rand() * 4;
    }
  }
  return out;
})();

// A handful of green families so no two neighbours look quite alike.
const TREE_PALETTES = [
  {
    base: "fill-emerald-700 dark:fill-emerald-800",
    mid: "fill-emerald-600 dark:fill-emerald-700",
    hi: "fill-emerald-400/70",
  },
  {
    base: "fill-green-700 dark:fill-green-800",
    mid: "fill-green-600 dark:fill-green-700",
    hi: "fill-green-400/70",
  },
  {
    base: "fill-teal-700 dark:fill-teal-800",
    mid: "fill-teal-600 dark:fill-teal-700",
    hi: "fill-teal-300/70",
  },
  {
    base: "fill-lime-700 dark:fill-lime-800",
    mid: "fill-lime-600 dark:fill-lime-700",
    hi: "fill-lime-300/70",
  },
];

function spikePath(R: number, r: number, n: number): string {
  let d = "";
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI * i) / n;
    const rad = i % 2 === 0 ? R : r;
    d += `${i === 0 ? "M" : "L"}${(Math.cos(a) * rad).toFixed(1)},${(Math.sin(a) * rad).toFixed(1)} `;
  }
  return `${d}Z`;
}

type Lobe = { dx: number; dy: number; r: number };
type TreeT = {
  x: number;
  y: number;
  s: number;
  kind: number; // 0 round · 1 cluster · 2 conifer · 3 twin
  rot: number;
  pal: number;
  lobes: Lobe[];
  spikes: number;
  extent: number; // canopy radius, used for spacing
};

const TREE_GAP = 4; // breathing space kept between neighbouring canopies

const TREES: TreeT[] = (() => {
  const rand = mulberry32(9001);
  const out: TreeT[] = [];
  for (const p of PARKS) {
    for (let i = 0; i < p.trees; i++) {
      const s = 10 + rand() * 11;
      const kind = Math.floor(rand() * 4);
      const pal = Math.floor(rand() * TREE_PALETTES.length);
      const rot = rand() * 360;
      const spikes = 8 + Math.floor(rand() * 4);

      const lobes: Lobe[] = [];
      let extent = s * 0.62;
      if (kind === 1) {
        const n = 3 + Math.floor(rand() * 3);
        for (let l = 0; l < n; l++) {
          const ang = rand() * Math.PI * 2;
          const dist = s * (0.14 + rand() * 0.26);
          const r = s * (0.3 + rand() * 0.22);
          lobes.push({ dx: Math.cos(ang) * dist, dy: Math.sin(ang) * dist, r });
          extent = Math.max(extent, dist + r);
        }
      } else if (kind === 3) {
        extent = s * 0.75;
      }

      // Find a spot clear of every road and not touching an already-placed tree.
      for (let tries = 0; tries < 30; tries++) {
        const x = p.x + extent + rand() * Math.max(1, p.w - 2 * extent);
        const y = p.y + extent + rand() * Math.max(1, p.h - 2 * extent);
        if (distToRoad(x, y) <= ROAD_HALF + extent + 3) continue;
        if (
          out.some(
            (t) => Math.hypot(t.x - x, t.y - y) < extent + t.extent + TREE_GAP,
          )
        )
          continue;
        out.push({ x, y, s, kind, rot, pal, lobes, spikes, extent });
        break;
      }
    }
  }
  return out.sort((a, b) => a.y - b.y); // paint back-to-front
})();

// Top-down canopy. Cast shadow stays down-right; the canopy itself is rotated.
function Tree({ x, y, s, kind, rot, pal, lobes, spikes }: TreeT) {
  const c = TREE_PALETTES[pal];
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse
        cx={s * 0.18}
        cy={s * 0.2}
        rx={s * 0.62}
        ry={s * 0.5}
        className="fill-black/10"
      />
      <g transform={`rotate(${rot})`}>
        {kind === 0 && (
          <>
            <circle r={s * 0.6} className={c.base} />
            <circle r={s * 0.4} className={c.mid} />
            <circle r={s * 0.18} className={c.hi} />
          </>
        )}
        {kind === 1 && (
          <>
            {lobes.map((l, i) => (
              <circle
                key={i}
                cx={l.dx}
                cy={l.dy}
                r={l.r}
                className={i % 2 ? c.mid : c.base}
              />
            ))}
            <circle cx={-s * 0.2} cy={-s * 0.2} r={s * 0.13} className={c.hi} />
          </>
        )}
        {kind === 2 && (
          <>
            <path
              d={spikePath(s * 0.64, s * 0.34, spikes)}
              className={c.base}
            />
            <circle r={s * 0.33} className={c.mid} />
            <circle r={s * 0.13} className={c.hi} />
          </>
        )}
        {kind === 3 && (
          <>
            <circle cx={-s * 0.32} cy={0} r={s * 0.42} className={c.base} />
            <circle cx={s * 0.3} cy={s * 0.05} r={s * 0.36} className={c.mid} />
            <circle
              cx={-s * 0.42}
              cy={-s * 0.12}
              r={s * 0.12}
              className={c.hi}
            />
          </>
        )}
      </g>
    </g>
  );
}

type NodeInfo = {
  id: number;
  kind: "Vehicle" | "RSU";
  attack: AttackKey | null;
};

type Props = {
  /** Attacker node IDs per attack category. */
  attackers?: AttackerMap;
};

export default function NetworkMap({ attackers = EMPTY_ATTACKERS }: Props) {
  const [reduce, setReduce] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);
  const [selected, setSelected] = useState<NodeInfo | null>(null);

  const showTip = useCallback((e: React.MouseEvent, text: string) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top, text });
  }, []);
  const hideTip = useCallback(() => setHover(null), []);
  const closeDetail = useCallback(() => setSelected(null), []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected]);

  const assignment = useMemo(() => {
    const m = new Map<number, AttackKey>();
    for (const c of ATTACK_CATEGORIES) {
      for (const id of attackers[c.key] ?? []) m.set(id, c.key);
    }
    return m;
  }, [attackers]);

  const counts = useMemo(
    () =>
      ATTACK_CATEGORIES.map((c) => ({
        key: c.key,
        label: c.label,
        n: (attackers[c.key] ?? []).length,
      })).filter((c) => c.n > 0),
    [attackers],
  );
  const totalMalicious = counts.reduce((s, c) => s + c.n, 0);

  return (
    <div ref={wrapRef} className="relative flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl border border-black/[.06] bg-linear-to-br from-emerald-50 via-white to-sky-50 dark:border-white/[.08] dark:from-emerald-950/40 dark:via-zinc-900 dark:to-sky-950/40">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full"
          role="img"
          aria-label="Sample city map of 200 vehicles circulating past 121 roadside units, with parks, water and buildings; malicious nodes are coloured by attack type"
        >
          <defs>
            <filter id="nm-glow" x="-160%" y="-160%" width="420%" height="420%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* district ground */}
          <g className="fill-stone-200/50 dark:fill-stone-800/40">
            {DISTRICTS.map((d, i) => (
              <rect key={i} x={d.x} y={d.y} width={d.w} height={d.h} rx={16} />
            ))}
          </g>

          {/* parks */}
          <g className="fill-emerald-200/55 dark:fill-emerald-900/30">
            {PARKS.map((p, i) => (
              <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={20} />
            ))}
          </g>

          {/* water: river + ponds */}
          <g>
            <path
              d={RIVER}
              className="fill-none stroke-sky-200 dark:stroke-sky-900/60"
              strokeWidth={26}
              strokeLinecap="round"
            />
            <path
              d={RIVER}
              className="fill-none stroke-white/40 dark:stroke-sky-500/10"
              strokeWidth={7}
              strokeLinecap="round"
            />
            {PONDS.map((d, i) => (
              <g key={i}>
                <path d={d} className="fill-sky-200 dark:fill-sky-900/60" />
                <path
                  d={d}
                  className="fill-none stroke-sky-300/70 dark:stroke-sky-700/50"
                  strokeWidth={2}
                />
              </g>
            ))}
          </g>

          {/* RSU coverage bloom */}
          <g className="text-indigo-400 dark:text-indigo-500">
            {RSUS.map((s) => (
              <circle
                key={s.id}
                cx={s.x}
                cy={s.y}
                r={22}
                fill="currentColor"
                opacity={0.05}
              />
            ))}
          </g>

          {/* roads: casing + surface + centre line, per circuit */}
          {CIRCUIT_PATHS.map((d, i) => (
            <g key={i} fill="none" strokeLinejoin="round">
              <path
                d={d}
                className="stroke-slate-400/60 dark:stroke-slate-700/70"
                strokeWidth={14}
              />
              <path
                id={`nm-road-${i}`}
                d={d}
                className="stroke-white dark:stroke-slate-800"
                strokeWidth={9}
              />
              <path
                d={d}
                className="stroke-slate-300/70 dark:stroke-slate-600/60"
                strokeWidth={1.5}
                strokeDasharray="2 10"
                strokeLinecap="round"
              />
            </g>
          ))}

          {/* buildings — rooftop footprints seen from above */}
          {BUILDINGS.map((b, i) => (
            <g
              key={i}
              transform={`translate(${b.cx} ${b.cy}) rotate(${b.rot})`}
            >
              <rect
                x={-b.w / 2 + 2}
                y={-b.h / 2 + 3}
                width={b.w}
                height={b.h}
                rx={2}
                className="fill-black/10"
              />
              <rect
                x={-b.w / 2}
                y={-b.h / 2}
                width={b.w}
                height={b.h}
                rx={2}
                className={B_BODY[b.t]}
                stroke="currentColor"
                strokeOpacity={0.12}
                strokeWidth={1}
              />
              <rect
                x={-b.w / 2 + b.w * 0.16}
                y={-b.h / 2 + b.h * 0.16}
                width={b.w * 0.68}
                height={b.h * 0.68}
                rx={1.5}
                className={B_ROOF[b.t]}
              />
            </g>
          ))}

          {/* trees */}
          {TREES.map((t, i) => (
            <Tree key={i} {...t} />
          ))}

          {/* roadside units */}
          {RSUS.map((s) => {
            const key = assignment.get(s.id);
            const size = key ? 11 : 8.5;
            const title = nodeTitle(s.id, "RSU", key);
            return (
              <rect
                key={s.id}
                x={s.x - size / 2}
                y={s.y - size / 2}
                width={size}
                height={size}
                rx={2.5}
                className={`${
                  key
                    ? CATEGORY_FILL[key]
                    : "fill-indigo-500 dark:fill-indigo-400"
                } cursor-pointer`}
                stroke={key ? MALICIOUS_RING : undefined}
                strokeWidth={key ? 1.4 : undefined}
                filter={key ? "url(#nm-glow)" : undefined}
                onMouseEnter={(e) => showTip(e, title)}
                onMouseMove={(e) => showTip(e, title)}
                onMouseLeave={hideTip}
                onClick={() =>
                  setSelected({ id: s.id, kind: "RSU", attack: key ?? null })
                }
              />
            );
          })}

          {/* vehicles */}
          {VEHICLES.map((v) => {
            const key = assignment.get(v.id);
            const [cx, cy] = CIRCUITS[v.circuit].fn(
              v.reverse ? 1 - v.start : v.start,
            );
            const cls = `${
              key ? CATEGORY_FILL[key] : "fill-slate-500 dark:fill-slate-400"
            } cursor-pointer`;
            const r = key ? v.r + 1.6 : v.r;
            const ring = key ? MALICIOUS_RING : undefined;
            const glow = key ? "url(#nm-glow)" : undefined;
            const title = nodeTitle(v.id, "Vehicle", key);
            const onEnter = (e: React.MouseEvent) => showTip(e, title);
            const onClick = () =>
              setSelected({ id: v.id, kind: "Vehicle", attack: key ?? null });

            if (reduce) {
              return (
                <circle
                  key={v.id}
                  cx={cx}
                  cy={cy}
                  r={r}
                  className={cls}
                  stroke={ring}
                  strokeWidth={key ? 1.3 : undefined}
                  filter={glow}
                  onMouseEnter={onEnter}
                  onMouseMove={onEnter}
                  onMouseLeave={hideTip}
                  onClick={onClick}
                />
              );
            }

            return (
              <circle
                key={v.id}
                r={r}
                className={cls}
                stroke={ring}
                strokeWidth={key ? 1.3 : undefined}
                filter={glow}
                onMouseEnter={onEnter}
                onMouseMove={onEnter}
                onMouseLeave={hideTip}
                onClick={onClick}
              >
                <animateMotion
                  dur={`${v.dur.toFixed(2)}s`}
                  begin={`${v.begin.toFixed(2)}s`}
                  repeatCount="indefinite"
                  calcMode="linear"
                  keyPoints={v.reverse ? "1;0" : "0;1"}
                  keyTimes="0;1"
                >
                  <mpath href={`#nm-road-${v.circuit}`} />
                </animateMotion>
                {key && (
                  <animate
                    attributeName="opacity"
                    values="1;0.5;1"
                    dur="1.6s"
                    repeatCount="indefinite"
                  />
                )}
              </circle>
            );
          })}
        </svg>
      </div>

      <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-600 dark:text-zinc-300">
        {totalMalicious === 0 ? (
          <li className="text-zinc-500 dark:text-zinc-400">
            No attacker nodes configured
          </li>
        ) : (
          counts.map((c) => (
            <li key={c.key} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full ring-2 ring-red-500"
                style={{ background: CATEGORY_SWATCH[c.key] }}
              />
              {c.label} — {c.n}
            </li>
          ))
        )}
        <li className="flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
          Vehicles 200
        </li>
        <li className="flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-indigo-500" />
          RSUs 121
        </li>
      </ul>

      {hover && (
        <div
          className={`pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-900/95 px-2 py-1 text-[11px] font-medium text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900 ${
            hover.y < 34 ? "translate-y-3" : "-translate-y-[calc(100%+10px)]"
          }`}
          style={{ left: hover.x, top: hover.y }}
        >
          {hover.text}
        </div>
      )}

      {selected && <NodeDetail info={selected} onClose={closeDetail} />}
    </div>
  );
}

function NodeDetail({
  info,
  onClose,
}: {
  info: NodeInfo;
  onClose: () => void;
}) {
  const attackLabel = info.attack ? CAT_LABEL[info.attack] : null;

  const rows: [string, React.ReactNode][] = [
    ["Node ID", info.id],
    ["Type", info.kind === "Vehicle" ? "Vehicle (OBU)" : "Roadside unit (RSU)"],
    [
      "Status",
      info.attack ? (
        <span className="font-semibold text-red-600 dark:text-red-400">
          Malicious
        </span>
      ) : (
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
          Benign
        </span>
      ),
    ],
  ];
  if (info.attack && attackLabel) {
    rows.push([
      "Attack type",
      <span key="a" className="inline-flex items-center gap-1.5">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: CATEGORY_SWATCH[info.attack] }}
        />
        {attackLabel}
      </span>,
    ]);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${info.kind} ${info.id} details`}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/50"
      />
      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-xl border border-black/[.08] bg-white shadow-2xl dark:border-white/[.12] dark:bg-zinc-900">
        <header className="flex items-center justify-between border-b border-black/[.08] px-5 py-4 dark:border-white/[.1]">
          <h2 className="text-sm font-semibold">
            {info.kind} {info.id}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-lg leading-none text-zinc-500 hover:bg-black/[.05] dark:hover:bg-white/[.08]"
          >
            ×
          </button>
        </header>
        <dl className="flex flex-col divide-y divide-black/[.06] px-5 dark:divide-white/[.08]">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between gap-4 py-3 text-sm"
            >
              <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
              <dd className="text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>,
    document.body,
  );
}
