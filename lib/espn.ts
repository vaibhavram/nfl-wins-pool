// Server-only adapter around ESPN's public (unofficial, unauthenticated) NFL JSON endpoints.
// Not imported by client components — go through the /api/nfl/* route handlers instead.
import "server-only";
import type { TeamRecord } from "./teams";
import { isGameActive } from "./game-window";

const SITE_BASE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
const CORE_BASE = "https://site.api.espn.com/apis/v2/sports/football/nfl";

const REGULAR_SEASON = 2;
const CALENDAR_REVALIDATE_SECONDS = 3600;

async function getJson<T>(url: string, revalidate: number | "no-store"): Promise<T> {
  const res = await fetch(url, revalidate === "no-store" ? { cache: "no-store" } : { next: { revalidate } });
  if (!res.ok) throw new Error(`ESPN request failed (${res.status}): ${url}`);
  return res.json() as Promise<T>;
}

// ── Current week ──────────────────────────────────────────────────────────

type CalendarEntry = { value: string; startDate: string; endDate: string };
type CalendarBlock = { value: string; entries: CalendarEntry[] };
type ScoreboardResponse = {
  season: { year: number };
  leagues: [{ calendar: CalendarBlock[] }];
};

/** Which regular-season week (1-18) "now" falls in, and that season's year. Before the season starts, week 1 (upcoming); after it ends, week 18. */
export async function getCurrentRegularSeasonWeek(): Promise<{ week: number; year: number }> {
  const data = await getJson<ScoreboardResponse>(`${SITE_BASE}/scoreboard`, CALENDAR_REVALIDATE_SECONDS);
  const year = data.season.year; // NFL "season year" is constant across Aug–Feb, even for the Jan/Feb games
  const regSeason = data.leagues[0].calendar.find((b) => b.value === String(REGULAR_SEASON));
  if (!regSeason) return { week: 1, year };
  const now = Date.now();
  const entries = regSeason.entries;
  if (now < new Date(entries[0].startDate).getTime()) return { week: 1, year };
  for (const entry of entries) {
    if (now >= new Date(entry.startDate).getTime() && now <= new Date(entry.endDate).getTime()) {
      return { week: Number(entry.value), year };
    }
  }
  return { week: entries.length, year };
}

// ── Week scoreboard ──────────────────────────────────────────────────────

export type LiveGame = {
  id: string; // ESPN's event id -- addresses the per-game summary endpoint (see getGamePredictor)
  away: string;
  home: string;
  awayScore: number | null;
  homeScore: number | null;
  completed: boolean;
  state: "pre" | "in" | "post"; // "in" is the live, in-progress state
  statusDetail: string; // e.g. "8:42 - 3rd", "Halftime", "Final" -- ESPN's own short status text
  liveHomeWinProb: number | null; // ESPN's own live, play-by-play win probability; null before kickoff
  possession: "home" | "away" | null; // which side has the ball right now; null unless live
  downDistanceText: string | null; // e.g. "1st & 10 at NE 47"; null unless live
  isRedZone: boolean;
  date: string; // ISO kickoff timestamp — client formats it in the viewer's own timezone
};

export type LiveWeek = {
  week: number;
  games: LiveGame[];
  byeTeams: string[];
};

type ScoreboardEvent = {
  id: string;
  date: string;
  status: { type: { completed: boolean; state: "pre" | "in" | "post"; shortDetail: string; description: string } };
  competitions: [
    {
      competitors: [
        { homeAway: "home" | "away"; team: { id: string; abbreviation: string }; score?: string },
        { homeAway: "home" | "away"; team: { id: string; abbreviation: string }; score?: string },
      ];
      // Present only once a game has kicked off. `possession` is the ESPN team id with the
      // ball (cross-referenced against the competitors' own team ids, below); the rest is
      // ESPN's own live win-probability model, updated play by play (the same number that
      // drives its live win-probability graph and its downDistanceText).
      situation?: {
        possession?: string;
        downDistanceText?: string;
        isRedZone?: boolean;
        lastPlay?: { probability?: { homeWinPercentage: number } };
      };
    },
  ];
};
type WeekScoreboardResponse = {
  week: { number: number; teamsOnBye?: { abbreviation: string }[] };
  events: ScoreboardEvent[];
};

/** Always a fresh, uncached fetch -- next.revalidate has failed to reliably invalidate in this
 * environment on this exact endpoint before (live games sat stuck as "pre" with null scores far
 * past their revalidate window, confirmed by comparing our own endpoint against a direct ESPN
 * fetch of the identical URL at the same moment), so this endpoint no longer offers a cached path
 * at all -- one no-store fetch per call, always. A single week is cheap (≤16 games); the caller
 * controls cost by deciding how often to call this (see lib/game-window.ts's isGameActive and
 * lib/live-data.ts's polling), not by asking this function to serve a stale copy. */
export async function getWeekScoreboard(week: number, year: number): Promise<LiveWeek> {
  // `dates=<year>` is load-bearing here: `week`+`year` alone silently falls back to the most
  // recently completed season (e.g. still serves 2025 well into 2026) until ESPN "promotes"
  // the requested season's data for that week. Confirmed by direct comparison against the API.
  const url = `${SITE_BASE}/scoreboard?week=${week}&seasontype=${REGULAR_SEASON}&year=${year}&dates=${year}`;
  const data = await getJson<WeekScoreboardResponse>(url, "no-store");
  const games: LiveGame[] = data.events.map((ev) => {
    const comp = ev.competitions[0];
    const away = comp.competitors.find((c) => c.homeAway === "away")!;
    const home = comp.competitors.find((c) => c.homeAway === "home")!;
    const completed = ev.status.type.completed;
    const state = ev.status.type.state;
    const scored = state !== "pre"; // score exists once a game has kicked off, not just once it's final
    const possessionTeamId = comp.situation?.possession;
    const possession: "home" | "away" | null =
      possessionTeamId === home.team.id ? "home" : possessionTeamId === away.team.id ? "away" : null;
    return {
      id: ev.id,
      away: away.team.abbreviation,
      home: home.team.abbreviation,
      awayScore: scored ? Number(away.score) : null,
      homeScore: scored ? Number(home.score) : null,
      completed,
      state,
      statusDetail: ev.status.type.shortDetail,
      liveHomeWinProb: comp.situation?.lastPlay?.probability?.homeWinPercentage ?? null,
      possession,
      downDistanceText: comp.situation?.downDistanceText ?? null,
      isRedZone: comp.situation?.isRedZone ?? false,
      date: ev.date,
    };
  });
  return {
    week: data.week.number,
    games,
    byeTeams: (data.week.teamsOnBye ?? []).map((t) => t.abbreviation),
  };
}

/** Is anything live or about to be (within its 5-minute pre-kickoff lead) right now, anywhere in
 * the current week -- used by routes whose own data has no live/game-state concept of its own
 * (standings, per-team schedule, projected wins) so their client hooks know whether it's worth
 * polling aggressively for a fresher answer. Including the pre-kickoff lead (not just `state ===
 * "in"`) matters: without it, a client that stopped polling after the previous game window closed
 * would have no signal to resume polling until the next kickoff had already happened. */
export async function hasLiveGameThisWeek(): Promise<boolean> {
  const { week, year } = await getCurrentRegularSeasonWeek();
  const board = await getWeekScoreboard(week, year);
  const now = Date.now();
  return board.games.some((g) => isGameActive(g.state, g.date, now));
}

// ── Pre-game win probability ("Matchup Predictor") ─────────────────────────

const PREDICTOR_REVALIDATE_SECONDS = 86400; // 24h -- this is inherently a pull-once-a-day number

type SummaryPredictorResponse = {
  predictor?: { homeTeam?: { gameProjection?: string }; awayTeam?: { gameProjection?: string } };
};

/** ESPN's own pre-game "Matchup Predictor" for one game, as a 0-1 home-win probability. Only
 * available on the per-game summary endpoint (not the scoreboard), one call per game -- callers
 * fetching this for many games should cap concurrency rather than fire them all at once, as a
 * courtesy to ESPN's free unauthenticated endpoint. Returns null (never throws) on any failure --
 * missing field, malformed number, request error -- so one bad game doesn't take down a caller
 * that's resolving many of these at once; callers should fall back to another model on null. */
export async function getGamePredictor(eventId: string): Promise<number | null> {
  try {
    const data = await getJson<SummaryPredictorResponse>(`${SITE_BASE}/summary?event=${eventId}`, PREDICTOR_REVALIDATE_SECONDS);
    const home = Number(data.predictor?.homeTeam?.gameProjection);
    const away = Number(data.predictor?.awayTeam?.gameProjection);
    if (!Number.isFinite(home) || !Number.isFinite(away) || home + away <= 0) return null;
    return home / (home + away); // normalizes even if the two don't sum to exactly 100
  } catch {
    return null;
  }
}

// ── Standings ─────────────────────────────────────────────────────────────

type StandingsStat = { name: string; value: number };
type StandingsEntry = { team: { abbreviation: string }; stats: StandingsStat[] };
type StandingsResponse = { standings: { season: number; entries: StandingsEntry[] } };

export async function getStandings(): Promise<Record<string, TeamRecord>> {
  // Without `seasontype`, ESPN defaults to whatever season type is "current" — during Aug/Sep
  // that's preseason (type 1), which would count Hall of Fame/preseason wins toward the pool.
  // no-store, not a revalidate window: seen this endpoint's cached response get stuck showing a
  // team's pre-game 0-0 record well after that team's game had actually finished (confirmed via
  // a direct ESPN fetch showing the real, updated record at the same moment) -- the standings
  // feed is cheap enough that always-fresh is worth more here than shaving a request.
  const data = await getJson<StandingsResponse>(`${CORE_BASE}/standings?level=1&seasontype=${REGULAR_SEASON}`, "no-store");
  const out: Record<string, TeamRecord> = {};
  for (const entry of data.standings.entries) {
    const stat = (name: string) => entry.stats.find((s) => s.name === name)?.value ?? 0;
    out[entry.team.abbreviation] = { wins: stat("wins"), losses: stat("losses"), ties: stat("ties") };
  }
  return out;
}

// ── Per-team full-season schedule ───────────────────────────────────────────

/** A live game's state from one particular team's point of view -- the scoreboard reports home
 * and away, but a team's own schedule row only cares about "us" and "them". Null on every row
 * that isn't currently in progress.
 *
 * Deliberately just the score and the clock: a team's schedule is a season-long list, read to see
 * how the year is going, so a live row there says what the score is and how much football is left
 * to change it. Down-and-distance and the red-zone flag live on the Schedule tab, which is the
 * play-by-play view. */
export type TeamScheduleLive = {
  myScore: number;
  oppScore: number;
  statusDetail: string; // ESPN's own short status text, e.g. "8:42 - 3rd" -- quarter and time left
  hasPossession: boolean; // whether *this* team has the ball, not the home team
};

export type TeamScheduleRow = {
  id: string; // ESPN's event id -- "" for the synthetic bye-week row; addresses the same game in getSeasonGameData
  week: number;
  at: "@" | "vs" | "";
  opponent: string;
  opponentAb: string; // "" for a bye week
  result: "W" | "L" | "T" | "";
  detail: string; // final score, once completed
  state: "pre" | "in" | "post"; // "pre" for the synthetic bye-week row
  date: string | null; // ISO kickoff timestamp for not-yet-played games; null for a bye week
};

// Right after a game ends, this endpoint briefly reports a completed game's score as an object
// ({value, displayValue}) instead of the plain numeric string it settles into shortly after --
// Number() on the object form silently produces NaN, so both shapes need handling explicitly.
type TeamScheduleScore = string | { value: number };
function scoreValue(score: TeamScheduleScore | undefined): number {
  return typeof score === "object" && score !== null ? score.value : Number(score);
}

type TeamScheduleEvent = {
  id: string;
  date: string;
  week: { number: number };
  competitions: [
    {
      status: { type: { completed: boolean; state: "pre" | "in" | "post"; shortDetail: string } };
      competitors: [
        { homeAway: "home" | "away"; team: { abbreviation: string; displayName: string }; score?: TeamScheduleScore; winner?: boolean },
        { homeAway: "home" | "away"; team: { abbreviation: string; displayName: string }; score?: TeamScheduleScore; winner?: boolean },
      ];
    },
  ];
};
type TeamScheduleResponse = { events: TeamScheduleEvent[] };

export async function getTeamSchedule(abbr: string): Promise<TeamScheduleRow[]> {
  // Without `seasontype`, this endpoint returns only preseason games (weeks 1-4) once the
  // preseason is underway — regular season needs to be requested explicitly.
  // no-store, same reasoning as getStandings(): this is exactly the feed that needs to flip a
  // game's result/state the moment it's final, not sit stale for an indeterminate window.
  const url = `${SITE_BASE}/teams/${abbr.toLowerCase()}/schedule?seasontype=${REGULAR_SEASON}`;
  const data = await getJson<TeamScheduleResponse>(url, "no-store");
  const rows: TeamScheduleRow[] = data.events.map((ev) => {
    const comp = ev.competitions[0];
    const me = comp.competitors.find((c) => c.team.abbreviation.toUpperCase() === abbr.toUpperCase())!;
    const opp = comp.competitors.find((c) => c !== me)!;
    const completed = comp.status.type.completed;
    let result: TeamScheduleRow["result"] = "";
    let detail = "";
    if (completed) {
      const myScore = scoreValue(me.score);
      const oppScore = scoreValue(opp.score);
      result = myScore === oppScore ? "T" : myScore > oppScore ? "W" : "L";
      detail = `${myScore}–${oppScore}`;
    }
    return {
      id: ev.id,
      week: ev.week.number,
      at: me.homeAway === "home" ? "vs" : "@",
      opponent: opp.team.displayName,
      opponentAb: opp.team.abbreviation,
      result,
      detail,
      state: comp.status.type.state,
      date: ev.date,
    };
  });
  // ESPN's `byeWeek` field is unreliable this far ahead of the season (seen pointing at a week
  // that already has a real game). Derive the bye from the actual gap in the 1-18 week sequence.
  const scheduledWeeks = new Set(rows.map((r) => r.week));
  for (let week = 1; week <= 18; week++) {
    if (!scheduledWeeks.has(week)) {
      rows.push({ id: "", week, at: "", opponent: "Bye week", opponentAb: "", result: "", detail: "", state: "pre", date: null });
      break;
    }
  }
  return rows.sort((a, b) => a.week - b.week);
}
