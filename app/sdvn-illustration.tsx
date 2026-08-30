type Props = { className?: string };

/**
 * Schematic of a Software-Defined Vehicular Network (SDVN) with a
 * blockchain-anchored DRL agent mitigating multipath routing attacks.
 * Pure inline SVG so it stays crisp and theme-aware in both light and dark.
 */
export default function SdvnIllustration({ className }: Props) {
  return (
    <svg
      viewBox="0 0 820 460"
      role="img"
      aria-label="Software-Defined Vehicular Network with a blockchain-centered DRL agent defending against multipath routing attacks"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <marker
          id="sdvn-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M0 0L10 5L0 10z" fill="currentColor" />
        </marker>
      </defs>

      {/* ---- Control plane ---- */}
      <g className="text-sky-500">
        <rect
          x="300"
          y="20"
          width="220"
          height="66"
          rx="12"
          fill="currentColor"
          fillOpacity="0.12"
          stroke="currentColor"
          strokeWidth="2"
        />
        <text
          x="410"
          y="47"
          textAnchor="middle"
          className="fill-current"
          fontSize="15"
          fontWeight="600"
        >
          SDN Controller
        </text>
        <text
          x="410"
          y="68"
          textAnchor="middle"
          className="fill-current"
          fillOpacity="0.7"
          fontSize="11"
        >
          global topology &amp; flow rules
        </text>
      </g>

      {/* ---- Blockchain ledger ---- */}
      <g className="text-amber-500">
        <rect
          x="24"
          y="120"
          width="176"
          height="120"
          rx="12"
          fill="currentColor"
          fillOpacity="0.1"
          stroke="currentColor"
          strokeWidth="2"
        />
        <text
          x="112"
          y="145"
          textAnchor="middle"
          className="fill-current"
          fontSize="14"
          fontWeight="600"
        >
          Blockchain Ledger
        </text>
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect
              x={40 + i * 50}
              y="165"
              width="40"
              height="40"
              rx="6"
              fill="currentColor"
              fillOpacity="0.18"
              stroke="currentColor"
              strokeWidth="2"
            />
            {i < 2 && (
              <line
                x1={80 + i * 50}
                y1="185"
                x2={90 + i * 50}
                y2="185"
                stroke="currentColor"
                strokeWidth="2"
              />
            )}
          </g>
        ))}
        <text
          x="112"
          y="226"
          textAnchor="middle"
          className="fill-current"
          fillOpacity="0.7"
          fontSize="10.5"
        >
          tamper-proof trust records
        </text>
      </g>

      {/* ---- DRL agent ---- */}
      <g className="text-emerald-500">
        <rect
          x="620"
          y="120"
          width="176"
          height="120"
          rx="12"
          fill="currentColor"
          fillOpacity="0.1"
          stroke="currentColor"
          strokeWidth="2"
        />
        <text
          x="708"
          y="145"
          textAnchor="middle"
          className="fill-current"
          fontSize="14"
          fontWeight="600"
        >
          DRL AI Agent
        </text>
        {[
          [660, 185],
          [708, 168],
          [708, 202],
          [756, 185],
        ].map(([cx, cy], i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r="8"
            fill="currentColor"
            fillOpacity="0.25"
            stroke="currentColor"
            strokeWidth="2"
          />
        ))}
        <path
          d="M660 185L708 168M660 185L708 202M708 168L756 185M708 202L756 185"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeOpacity="0.6"
        />
        <text
          x="708"
          y="226"
          textAnchor="middle"
          className="fill-current"
          fillOpacity="0.7"
          fontSize="10.5"
        >
          learns routing policy
        </text>
      </g>

      {/* ---- Control-plane links ---- */}
      <g className="text-zinc-400 dark:text-zinc-500" stroke="currentColor" strokeWidth="1.75">
        <line x1="200" y1="180" x2="300" y2="60" strokeDasharray="5 5" />
        <line x1="620" y1="180" x2="520" y2="60" strokeDasharray="5 5" />
        <line x1="410" y1="86" x2="410" y2="300" strokeDasharray="5 5" />
      </g>

      {/* ---- Data plane: road ---- */}
      <g>
        <rect
          x="24"
          y="300"
          width="772"
          height="96"
          rx="10"
          className="fill-zinc-200 dark:fill-zinc-800"
        />
        <line
          x1="40"
          y1="348"
          x2="780"
          y2="348"
          className="text-zinc-400 dark:text-zinc-600"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray="18 14"
        />
      </g>

      {/* RSUs */}
      {[130, 410, 690].map((x, i) => (
        <g key={i} className="text-sky-500">
          <line x1={x} y1="300" x2={x} y2="262" stroke="currentColor" strokeWidth="3" />
          <rect
            x={x - 14}
            y="238"
            width="28"
            height="26"
            rx="4"
            fill="currentColor"
            fillOpacity="0.15"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d={`M${x + 18} 240a16 16 0 0 1 0 22M${x + 26} 234a26 26 0 0 1 0 34`}
            stroke="currentColor"
            strokeWidth="2"
            strokeOpacity="0.7"
          />
          <text
            x={x}
            y="230"
            textAnchor="middle"
            className="fill-current"
            fontSize="10"
            fontWeight="600"
          >
            RSU{i + 1}
          </text>
        </g>
      ))}

      {/* Vehicles */}
      {[
        [210, "text-zinc-600 dark:text-zinc-300"],
        [360, "text-zinc-600 dark:text-zinc-300"],
        [560, "text-zinc-600 dark:text-zinc-300"],
      ].map(([x, cls], i) => (
        <g key={i} className={cls as string}>
          <rect
            x={Number(x) - 26}
            y="352"
            width="52"
            height="22"
            rx="6"
            fill="currentColor"
            fillOpacity="0.2"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d={`M${Number(x) - 16} 352l6 -12h16l8 12`}
            fill="currentColor"
            fillOpacity="0.2"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle cx={Number(x) - 14} cy="376" r="5" fill="currentColor" />
          <circle cx={Number(x) + 14} cy="376" r="5" fill="currentColor" />
        </g>
      ))}

      {/* ---- Multipath routes ---- */}
      <g fill="none" strokeWidth="2.5">
        {/* healthy paths */}
        <path
          d="M150 292C240 250 320 250 400 288"
          className="text-emerald-500"
          stroke="currentColor"
          markerEnd="url(#sdvn-arrow)"
        />
        <path
          d="M430 288C520 252 610 252 680 292"
          className="text-emerald-500"
          stroke="currentColor"
          markerEnd="url(#sdvn-arrow)"
        />
        {/* attacked path */}
        <path
          d="M150 296C300 210 520 210 680 296"
          className="text-red-500"
          stroke="currentColor"
          strokeDasharray="7 6"
          markerEnd="url(#sdvn-arrow)"
        />
        <g className="text-red-500">
          <path
            d="M415 205l12 20h-24z"
            fill="currentColor"
            fillOpacity="0.9"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <text
            x="415"
            y="240"
            textAnchor="middle"
            className="fill-current"
            fontSize="11"
            fontWeight="600"
          >
            multipath routing attack
          </text>
        </g>
      </g>

      {/* legend */}
      <g fontSize="11" className="fill-zinc-500 dark:fill-zinc-400">
        <rect x="24" y="424" width="18" height="4" rx="2" className="fill-emerald-500" />
        <text x="50" y="430">
          legitimate route
        </text>
        <rect x="200" y="424" width="18" height="4" rx="2" className="fill-red-500" />
        <text x="226" y="430">
          adversarial route
        </text>
        <rect x="380" y="422" width="18" height="8" rx="2" className="fill-sky-500" fillOpacity="0.4" />
        <text x="406" y="430">
          control-plane signalling
        </text>
      </g>
    </svg>
  );
}
