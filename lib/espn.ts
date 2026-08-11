// Server-only adapter around ESPN's public (unofficial, unauthenticated) NFL JSON endpoints.
// Not imported by client components — go through the /api/nfl/* route handlers instead.
import "server-only";
import type { TeamRecord } from "./teams";

const SITE_BASE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
const CORE_BASE = "https://site.api.espn.com/apis/v2/sports/football/nfl";

const REGULAR_SEASON = 2;
const WEEK_REVALIDATE_SECONDS = 300;
const CALENDAR_REVALIDATE_SECONDS = 3600;

async function getJson<T>(url: string, revalidate: number): Promise<T> {
  const res = await fetch(url, { next: { revalidate } });
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
  away: string;
  home: string;
  awayScore: number | null;
  homeScore: number | null;
  completed: boolean;
  date: string; // ISO kickoff timestamp — client formats it in the viewer's own timezone
};

export type LiveWeek = {
  week: number;
  games: LiveGame[];
  byeTeams: string[];
};

type ScoreboardEvent = {
  date: string;
  status: { type: { completed: boolean; shortDetail: string; description: string } };
  competitions: [
    {
      competitors: [
        { homeAway: "home" | "away"; team: { abbreviation: string }; score?: string },
        { homeAway: "home" | "away"; team: { abbreviation: string }; score?: string },
      ];
    },
  ];
};
type WeekScoreboardResponse = {
  week: { number: number; teamsOnBye?: { abbreviation: string }[] };
  events: ScoreboardEvent[];
};

export async function getWeekScoreboard(week: number, year: number): Promise<LiveWeek> {
  // `dates=<year>` is load-bearing here: `week`+`year` alone silently falls back to the most
  // recently completed season (e.g. still serves 2025 well into 2026) until ESPN "promotes"
  // the requested season's data for that week. Confirmed by direct comparison against the API.
  const url = `${SITE_BASE}/scoreboard?week=${week}&seasontype=${REGULAR_SEASON}&year=${year}&dates=${year}`;
  const data = await getJson<WeekScoreboardResponse>(url, WEEK_REVALIDATE_SECONDS);
  const games: LiveGame[] = data.events.map((ev) => {
    const comp = ev.competitions[0];
    const away = comp.competitors.find((c) => c.homeAway === "away")!;
    const home = comp.competitors.find((c) => c.homeAway === "home")!;
    const completed = ev.status.type.completed;
    return {
      away: away.team.abbreviation,
      home: home.team.abbreviation,
      awayScore: completed ? Number(away.score) : null,
      homeScore: completed ? Number(home.score) : null,
      completed,
      date: ev.date,
    };
  });
  return {
    week: data.week.number,
    games,
    byeTeams: (data.week.teamsOnBye ?? []).map((t) => t.abbreviation),
  };
}

// ── Standings ─────────────────────────────────────────────────────────────

type StandingsStat = { name: string; value: number };
type StandingsEntry = { team: { abbreviation: string }; stats: StandingsStat[] };
type StandingsResponse = { standings: { season: number; entries: StandingsEntry[] } };

export async function getStandings(): Promise<Record<string, TeamRecord>> {
  // Without `seasontype`, ESPN defaults to whatever season type is "current" — during Aug/Sep
  // that's preseason (type 1), which would count Hall of Fame/preseason wins toward the pool.
  const data = await getJson<StandingsResponse>(`${CORE_BASE}/standings?level=1&seasontype=${REGULAR_SEASON}`, WEEK_REVALIDATE_SECONDS);
  const out: Record<string, TeamRecord> = {};
  for (const entry of data.standings.entries) {
    const stat = (name: string) => entry.stats.find((s) => s.name === name)?.value ?? 0;
    out[entry.team.abbreviation] = { wins: stat("wins"), losses: stat("losses"), ties: stat("ties") };
  }
  return out;
}

// ── Per-team full-season schedule ───────────────────────────────────────────

export type TeamScheduleRow = {
  week: number;
  at: "@" | "vs" | "";
  opponent: string;
  opponentAb: string; // "" for a bye week
  result: "W" | "L" | "T" | "";
  detail: string; // final score, once completed
  date: string | null; // ISO kickoff timestamp for not-yet-played games; null for a bye week
};

type TeamScheduleEvent = {
  date: string;
  week: { number: number };
  competitions: [
    {
      status: { type: { completed: boolean; shortDetail: string } };
      competitors: [
        { homeAway: "home" | "away"; team: { abbreviation: string; displayName: string }; score?: string; winner?: boolean },
        { homeAway: "home" | "away"; team: { abbreviation: string; displayName: string }; score?: string; winner?: boolean },
      ];
    },
  ];
};
type TeamScheduleResponse = { events: TeamScheduleEvent[] };

export async function getTeamSchedule(abbr: string): Promise<TeamScheduleRow[]> {
  // Without `seasontype`, this endpoint returns only preseason games (weeks 1-4) once the
  // preseason is underway — regular season needs to be requested explicitly.
  const url = `${SITE_BASE}/teams/${abbr.toLowerCase()}/schedule?seasontype=${REGULAR_SEASON}`;
  const data = await getJson<TeamScheduleResponse>(url, WEEK_REVALIDATE_SECONDS);
  const rows: TeamScheduleRow[] = data.events.map((ev) => {
    const comp = ev.competitions[0];
    const me = comp.competitors.find((c) => c.team.abbreviation.toUpperCase() === abbr.toUpperCase())!;
    const opp = comp.competitors.find((c) => c !== me)!;
    const completed = comp.status.type.completed;
    let result: TeamScheduleRow["result"] = "";
    let detail = "";
    if (completed) {
      const myScore = Number(me.score);
      const oppScore = Number(opp.score);
      result = myScore === oppScore ? "T" : myScore > oppScore ? "W" : "L";
      detail = `${myScore}–${oppScore}`;
    }
    return {
      week: ev.week.number,
      at: me.homeAway === "home" ? "vs" : "@",
      opponent: opp.team.displayName,
      opponentAb: opp.team.abbreviation,
      result,
      detail,
      date: ev.date,
    };
  });
  // ESPN's `byeWeek` field is unreliable this far ahead of the season (seen pointing at a week
  // that already has a real game). Derive the bye from the actual gap in the 1-18 week sequence.
  const scheduledWeeks = new Set(rows.map((r) => r.week));
  for (let week = 1; week <= 18; week++) {
    if (!scheduledWeeks.has(week)) {
      rows.push({ week, at: "", opponent: "Bye week", opponentAb: "", result: "", detail: "", date: null });
      break;
    }
  }
  return rows.sort((a, b) => a.week - b.week);
}
