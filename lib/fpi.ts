// Server-only scraper for ESPN's FPI (Football Power Index) ratings. Unlike nfelo's raw Elo,
// FPI is already reset for the current season by the time this was checked (confirmed via its
// `lastUpdated` field and every team sitting at 0-0-0), so it needs no manual regression.
// There's no public API for this either — it's embedded in ESPN's page-data blob
// (`window['__espnfitt__']`), so this pulls the page and extracts that directly.
import "server-only";

const FPI_URL = "https://www.espn.com/nfl/fpi";
const REVALIDATE_SECONDS = 6 * 60 * 60;
const MARKER = "window['__espnfitt__']=";

/** Finds the matching closing brace for the `{` at `source[startIndex]`, respecting quoted strings. */
function extractBalancedObject(source: string, startIndex: number): string {
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
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return source.slice(startIndex, i + 1);
    }
  }
  throw new Error("fpi: unbalanced object in page-data payload");
}

type FpiStat = { name: string; value: string };
type FpiTableEntry = { team: { abbrev: string }; stats: FpiStat[] };
type EspnFittPayload = {
  page: { content: { table: { stats: FpiTableEntry[] } } };
};

/** Fetches current per-team FPI ratings (expected point margin vs. a league-average team on a
 * neutral field), keyed by team abbreviation. */
export async function getFpiRatings(): Promise<Record<string, number>> {
  const res = await fetch(FPI_URL, {
    next: { revalidate: REVALIDATE_SECONDS },
    headers: { "User-Agent": "Mozilla/5.0 (compatible; nfl-wins-pool/1.0)" },
  });
  if (!res.ok) throw new Error(`FPI request failed (${res.status})`);
  const html = await res.text();

  const start = html.indexOf(MARKER);
  if (start === -1) throw new Error("fpi: page-data marker not found — page structure may have changed");
  const objJson = extractBalancedObject(html, start + MARKER.length);
  const data: EspnFittPayload = JSON.parse(objJson);

  const out: Record<string, number> = {};
  for (const entry of data.page.content.table.stats) {
    const fpiStat = entry.stats.find((s) => s.name === "fpi");
    if (fpiStat) out[entry.team.abbrev] = Number(fpiStat.value);
  }
  return out;
}
