// The digest's leaderboard as real HTML, not a hosted PNG.
//
// It used to be a Satori-rendered image served from an in-memory Map (lib/email-image-store.ts,
// now deleted): an email client fetches an image when the recipient *opens* the mail, often days
// later, so every restart of this service -- a deploy, a crash, an OOM -- emptied that Map and
// silently 404'd the leaderboard in every digest already sitting in people's inboxes. Markup has
// no such lifetime: it travels inside the message.
//
// It also renders for readers who block remote images (common by default, and Apple Mail Privacy
// Protection proxies them), where the old version showed nothing at all.
//
// Email HTML is a restricted subset -- Outlook renders through Word's engine, which ignores flex
// and grid -- so a column-aligned leaderboard has to be a <table> with inline styles on every
// cell, the same constraint lib/email-template.ts already works under.
//
// Note the deliberate duplication: lib/leaderboard-image.tsx still draws this same leaderboard for
// the Standings tab's save-to-photos button. Satori's CSS subset and email HTML's subset don't
// overlap enough to share an implementation, so the two are kept in step by hand.
import { escapeHtml } from "./format";
import { formatWinPct } from "./format";
import { TEAM } from "./teams";

export type LeaderboardEmailRow = { name: string; teams: string[]; wins: number; winPct: number | null };

const TEXT = "#e9e9ed";
const ACCENT_300 = "#d2cefd";
const ACCENT_400 = "#b5abfc";
const NEUTRAL_400 = "#b2b6ca";
const DIVIDER = "rgba(233,233,237,0.16)";
const CREST = 22;

function fmtWins(w: number): string {
  return Number.isInteger(w) ? String(w) : w.toFixed(1);
}

/** Crests hotlink straight to ESPN's CDN (lib/teams.ts already builds those URLs), so this app
 * hosts nothing. A reader with images blocked still gets the roster: each crest's alt text is the
 * team's abbreviation, so the cell degrades to "BUF MIN NYG" rather than three empty boxes. */
function crests(teams: string[]): string {
  return teams
    .map((ab) => {
      const logo = TEAM[ab]?.logo;
      if (!logo) return `<span style="color:${NEUTRAL_400}; font-size:12px;">${escapeHtml(ab)}</span>`;
      return `<img src="${logo}" width="${CREST}" height="${CREST}" alt="${escapeHtml(ab)}" style="vertical-align:middle; margin-left:4px;" />`;
    })
    .join("");
}

export function renderLeaderboardTable(rows: LeaderboardEmailRow[]): string {
  const body = rows
    .map((r, i) => {
      const last = i === rows.length - 1;
      const cell = `padding:9px 0; ${last ? "" : `border-bottom:1px solid ${DIVIDER};`}`;
      const rank = i === 0 ? ACCENT_300 : NEUTRAL_400;
      const prob =
        r.winPct === null
          ? ""
          : `<div style="font-size:11.5px; color:${ACCENT_400}; margin-top:1px;">${formatWinPct(r.winPct)}% chance of winning</div>`;
      return `
      <tr>
        <td style="${cell} width:22px; color:${rank}; font-size:13px; vertical-align:middle;">${i + 1}</td>
        <td style="${cell} color:${TEXT}; font-size:14px; vertical-align:middle;">${escapeHtml(r.name)}${prob}</td>
        <td style="${cell} text-align:right; white-space:nowrap; vertical-align:middle;">${crests(r.teams)}</td>
        <td style="${cell} width:46px; text-align:right; color:${TEXT}; font-size:18px; font-weight:700; vertical-align:middle;">${fmtWins(r.wins)}</td>
      </tr>`;
    })
    .join("");

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; border-collapse:collapse; margin:0 0 22px;">${body}</table>`;
}

/** The same standings for the plain-text part of the message. */
export function renderLeaderboardText(rows: LeaderboardEmailRow[]): string {
  return rows
    .map((r, i) => {
      const prob = r.winPct === null ? "" : ` (${formatWinPct(r.winPct)}% chance of winning)`;
      return `${i + 1}. ${r.name} -- ${fmtWins(r.wins)} wins${prob} -- ${r.teams.join(", ")}`;
    })
    .join("\n");
}
