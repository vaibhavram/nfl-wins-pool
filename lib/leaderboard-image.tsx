// Renders a static standings-style PNG via next/og's Satori-based image generation -- no headless
// browser dependency, at the cost of being a recreation of the Standings tab's layout rather than
// a literal screenshot of it. Shared by the weekly digest email and the Standings tab's own
// save-to-photos button, so both produce the same image.
import "server-only";
import { ImageResponse } from "next/og";
import { TEAM } from "./teams";
import { formatWinPct } from "./format";

/** Deliberately its own type rather than the digest's StandingsRow: the digest carries a
 * pre-week/post-week pair for its "change this week" copy, while the Standings tab only ever has
 * one live number. Both collapse to the single `winPct` the image actually draws. `null` means
 * "no simulation number available" (the row just omits the line) -- not 0%. */
export type LeaderboardImageRow = { name: string; teams: string[]; wins: number; winPct: number | null };

const WIDTH = 640;
const ROW_HEIGHT = 62;
const HEADER_HEIGHT = 72;
const PADDING = 28;

// Matching app/globals.css -- Satori resolves no CSS variables, so the theme's values are
// repeated here as literals.
const TEXT = "#e9e9ed";
const ACCENT_300 = "#d2cefd";
const ACCENT_400 = "#b5abfc";
const NEUTRAL_500 = "#9397ab";
const DIVIDER = "#23272e";
const BACKGROUND = "#0b0e13";

export async function renderLeaderboardImage(poolName: string, rows: LeaderboardImageRow[]): Promise<Buffer> {
  const height = HEADER_HEIGHT + rows.length * ROW_HEIGHT + PADDING * 2;
  const image = new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height,
          display: "flex",
          flexDirection: "column",
          background: BACKGROUND,
          padding: PADDING,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", color: TEXT, fontSize: 24, marginBottom: 20 }}>{poolName}</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {rows.map((r, i) => (
            <div
              key={r.name}
              style={{
                display: "flex",
                alignItems: "center",
                height: ROW_HEIGHT,
                borderTop: i === 0 ? "none" : `1px solid ${DIVIDER}`,
              }}
            >
              <div style={{ display: "flex", width: 26, color: i === 0 ? ACCENT_300 : NEUTRAL_500, fontSize: 15 }}>{i + 1}</div>
              <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 3 }}>
                <div style={{ display: "flex", color: TEXT, fontSize: 16 }}>{r.name}</div>
                {r.winPct !== null && (
                  <div style={{ display: "flex", color: ACCENT_400, fontSize: 12 }}>{formatWinPct(r.winPct)}% win prob</div>
                )}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {r.teams.map((ab) => (
                  // The same dark-on-dark problem the app's TeamLogo solves with a drop-shadow
                  // halo (Giants, Rams and friends vanish into the background). Satori supports
                  // no CSS filters, so the halo is a soft radial wash behind the crest instead.
                  <div
                    key={ab}
                    style={{
                      display: "flex",
                      width: 26,
                      height: 26,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 13,
                      background: "radial-gradient(circle, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0) 72%)",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- Satori image node, not a browser <img> */}
                    <img src={TEAM[ab]?.logo} width={26} height={26} alt={ab} />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", width: 56, justifyContent: "flex-end", color: TEXT, fontSize: 20 }}>
                {Number.isInteger(r.wins) ? r.wins : r.wins.toFixed(1)}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    { width: WIDTH, height },
  );
  return Buffer.from(await image.arrayBuffer());
}
