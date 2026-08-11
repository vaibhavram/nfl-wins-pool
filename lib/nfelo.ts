// Server-only scraper for nfeloapp.com's NFL power ratings. There's no public API for this data —
// it's embedded as a JSON blob inside a Next.js RSC data chunk in the page's initial HTML, so this
// pulls the page and extracts that chunk directly. Fragile to their frontend markup changing, but
// stable as long as they stay on Next.js App Router with server-rendered RSC payloads.
import "server-only";

const NFELO_URL = "https://www.nfeloapp.com/nfl-power-ratings/";
const REVALIDATE_SECONDS = 6 * 60 * 60; // ratings move slowly — a few times a week at most

// nfelo uses legacy/alternate abbreviations for two franchises; remap to this app's (ESPN-based) ones.
const ABBR_REMAP: Record<string, string> = { OAK: "LV", WAS: "WSH" };

export type NfeloRating = {
  ab: string;
  elo: number; // nfelo's Elo rating
  eloQbAdj: number; // delta applied for the current starting QB — add to `elo` for a QB-adjusted rating
};

type NfeloRow = { team: string; season: number; nfelo: number; nfeloQbAdj: number };

/** Finds the matching closing bracket for the `[` at `source[startIndex]`, respecting quoted strings. */
function extractBalancedArray(source: string, startIndex: number): string {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = startIndex; i < source.length; i++) {
    const c = source[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return source.slice(startIndex, i + 1);
    }
  }
  throw new Error("nfelo: unbalanced array in RSC payload");
}

/** Fetches and parses nfelo's current per-team power ratings, keyed by this app's team abbreviations. */
export async function getNfeloRatings(): Promise<Record<string, NfeloRating>> {
  const res = await fetch(NFELO_URL, {
    next: { revalidate: REVALIDATE_SECONDS },
    headers: { "User-Agent": "Mozilla/5.0 (compatible; nfl-wins-pool/1.0)" },
  });
  if (!res.ok) throw new Error(`nfelo request failed (${res.status})`);
  const html = await res.text();

  // Next.js streams RSC data as `self.__next_f.push([1,"<escaped JSON-ish string>"])` script tags.
  // "nfelo" alone isn't a unique-enough marker (it's also the site's brand name, quoted in page
  // copy elsewhere) — require the actual ratings-array shape too.
  const scriptRe = /__next_f\.push\(\[1,"((?:[^"\\]|\\[\s\S])*)"\]\)<\/script>/g;
  let target: string | null = null;
  let match: RegExpExecArray | null;
  while ((match = scriptRe.exec(html))) {
    if (match[1].includes('\\"nfelo\\"') && match[1].includes('\\"data\\":[')) {
      target = match[1];
      break;
    }
  }
  if (!target) throw new Error("nfelo: ratings chunk not found — page structure may have changed");

  // The chunk is a JS string literal (quotes/backslashes escaped) — JSON's string-escaping rules
  // are a superset of what Next emits here, so wrapping in quotes and parsing unescapes it cleanly.
  const decoded: string = JSON.parse(`"${target}"`);

  const marker = '"data":[';
  const idx = decoded.indexOf(marker);
  if (idx === -1) throw new Error('nfelo: "data" field not found in ratings chunk');
  const arrayJson = extractBalancedArray(decoded, idx + marker.length - 1);
  const rows: NfeloRow[] = JSON.parse(arrayJson);

  const out: Record<string, NfeloRating> = {};
  for (const row of rows) {
    const ab = ABBR_REMAP[row.team] ?? row.team;
    out[ab] = { ab, elo: row.nfelo, eloQbAdj: row.nfeloQbAdj };
  }
  return out;
}
