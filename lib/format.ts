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

/** A projected/average win total — whole number as-is, one decimal place otherwise (a
 * probability-weighted sum like projected wins is essentially never a clean integer). */
export function formatWins(w: number): string {
  return Number.isInteger(w) ? String(w) : w.toFixed(1);
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapes text for safe interpolation into an HTML string template (e.g. an email body) --
 * needed anywhere untrusted or generated text, like an LLM recap, gets embedded directly. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/** 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 11-13 -> "th" (the standard English exceptions). */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
