/** Formats an ISO kickoff timestamp in the viewer's own local timezone (not ESPN's Eastern-time
 * strings) — e.g. "Thu, 9/9 - 8:20 PM". */
export function formatKickoff(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { weekday: "short", month: "numeric", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${date} - ${time}`;
}

/** A win probability as a percentage string — one decimal place below 10% (where the extra
 * precision distinguishes long-shots), a whole number otherwise. Takes a 0-100 value. */
export function formatWinPct(pct: number): string {
  return pct < 10 ? pct.toFixed(1) : Math.round(pct).toString();
}
