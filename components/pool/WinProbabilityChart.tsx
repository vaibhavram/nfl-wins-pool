"use client";

import { useState } from "react";
import { formatWinPct } from "@/lib/format";

/** One manager's pool win probability at the end of each week, with a Pre-W1 baseline.
 *
 * Inline SVG rather than a charting library: one chart, one series, and the app ships no chart
 * dependency today. Single series means no legend -- the heading says what is plotted -- and the
 * values are direct-labelled only at the ends, with the rest carried by the axis and the hover
 * tooltip, so the bars stay the loudest thing on the card. */
export function WinProbabilityChart({ checkpoints, values }: { checkpoints: string[]; values: number[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (checkpoints.length === 0 || values.length === 0) return null;

  const W = 320;
  const H = 132; // plot only; the x-axis band is laid out below it, not squeezed inside
  const PAD_L = 26;
  const PAD_R = 6;
  const PAD_T = 10;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T;

  // A probability axis, so the scale is anchored at zero and topped at a round number above the
  // peak rather than fitted tightly to the data -- a bar chart that doesn't start at zero
  // misstates every comparison on it.
  const peak = Math.max(...values, 1);
  const top = Math.min(100, Math.ceil(peak / 25) * 25);
  const ticks = [0, top / 2, top];

  const band = plotW / values.length;
  const barW = Math.min(24, Math.max(4, band - 2)); // <=24px, with a 2px surface gap between bars
  const x = (i: number) => PAD_L + i * band + (band - barW) / 2;
  const y = (v: number) => PAD_T + plotH - (v / top) * plotH;

  const lastIndex = values.length - 1;
  const peakIndex = values.indexOf(Math.max(...values));
  const labelled = new Set([0, lastIndex, peakIndex]);

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Pool win probability by week">
        {ticks.map((t) => (
          <g key={t}>
            {/* hairline, solid, one step off the surface -- recessive */}
            <line x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)} stroke="var(--color-divider)" strokeWidth={1} />
            <text x={PAD_L - 6} y={y(t) + 3.5} textAnchor="end" fontSize={9} fill="var(--color-neutral-600)" style={{ fontVariantNumeric: "tabular-nums" }}>
              {t}
            </text>
          </g>
        ))}
        {values.map((v, i) => {
          const barH = Math.max(1, (v / top) * plotH);
          const active = hover === i;
          return (
            <g key={i} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
              {/* full-height hit target, so a 2px bar is still hoverable */}
              <rect x={PAD_L + i * band} y={PAD_T} width={band} height={plotH} fill="transparent" />
              <rect
                x={x(i)}
                y={y(v)}
                width={barW}
                height={barH}
                rx={Math.min(4, barW / 2)}
                fill={active ? "var(--color-accent-300)" : "var(--color-accent-500)"}
              />
              {/* square off the rounded corners where the bar meets the baseline */}
              <rect x={x(i)} y={y(v) + barH - Math.min(4, barH)} width={barW} height={Math.min(4, barH)} fill={active ? "var(--color-accent-300)" : "var(--color-accent-500)"} />
              {labelled.has(i) && !active && (
                <text x={x(i) + barW / 2} y={y(v) - 4} textAnchor="middle" fontSize={9} fill="var(--color-neutral-400)" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatWinPct(v)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {/* x-axis band, outside the plot height so labels can never be clipped by it */}
      <div style={{ display: "flex", paddingLeft: `${(PAD_L / W) * 100}%`, paddingRight: `${(PAD_R / W) * 100}%` }}>
        {checkpoints.map((c, i) => (
          <div
            key={c}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 8.5,
              color: hover === i ? "var(--color-accent-300)" : "var(--color-neutral-600)",
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            {/* Pre-W1 is twice the width of a "W7"; drop every other week label when they'd collide */}
            {checkpoints.length > 10 && i > 0 && i % 2 === 0 ? "" : c}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 6, fontSize: 11.5, color: "var(--color-neutral-500)", minHeight: 16 }}>
        {hover !== null
          ? `${checkpoints[hover]}: ${formatWinPct(values[hover])}% chance of winning the pool`
          : `${formatWinPct(values[lastIndex])}% after ${checkpoints[lastIndex]}, from ${formatWinPct(values[0])}% before the season`}
      </div>
    </div>
  );
}
