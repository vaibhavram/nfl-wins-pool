// Season-scoped port of lib/draft-server.ts -- every query gains a season_id, "manager" becomes
// a user_id, and the draft-position shuffle is already handled once by
// lib/pools-server.ts's seedSeasonManagers() at the filling->ready transition, so this file only
// ever *reads* season_managers, never reshuffles it. No reset capability here by design (v2 has
// no "Reset draft" button at all -- see the multi-tenant plan).
import "server-only";
import { query } from "./db2";
import { buildDraftOrder, TOTAL_PICKS, type Pick } from "./draft";
import { TEAMS } from "./teams";

export async function getSeasonPicks(seasonId: string): Promise<Pick[]> {
  const rows = await query<{ pick_no: number; user_id: string; team_ab: string }>(
    "SELECT pick_no, user_id, team_ab FROM season_picks WHERE season_id = $1 ORDER BY pick_no ASC",
    [seasonId],
  );
  return rows.map((r) => ({ pickNo: r.pick_no, manager: r.user_id, teamAb: r.team_ab }));
}

export type SeasonManager = { userId: string; displayName: string; draftPosition: number };

export async function getSeasonManagers(seasonId: string): Promise<SeasonManager[]> {
  const rows = await query<{ user_id: string; display_name: string; draft_position: number }>(
    "SELECT user_id, display_name, draft_position FROM season_managers WHERE season_id = $1 ORDER BY draft_position ASC",
    [seasonId],
  );
  return rows.map((r) => ({ userId: r.user_id, displayName: r.display_name, draftPosition: r.draft_position }));
}

async function logEvent(
  seasonId: string,
  eventType: "start" | "pick" | "auto_pick",
  fields: { pickNo?: number; userId?: string; teamAb?: string } = {},
): Promise<void> {
  await query("INSERT INTO season_events (season_id, event_type, pick_no, user_id, team_ab) VALUES ($1, $2, $3, $4, $5)", [
    seasonId,
    eventType,
    fields.pickNo ?? null,
    fields.userId ?? null,
    fields.teamAb ?? null,
  ]);
}

type SeasonStatusRow = { status: string; pick_clock_seconds: number; draft_started_at: string | null };

async function getSeasonStatus(seasonId: string): Promise<SeasonStatusRow | null> {
  const rows = await query<SeasonStatusRow>(
    "SELECT status, pick_clock_seconds, draft_started_at FROM pool_seasons WHERE id = $1",
    [seasonId],
  );
  return rows[0] ?? null;
}

/** Commissioner-only (checked by the route) -- only legal from 'ready', i.e. once the pool has
 * filled and seedSeasonManagers has assigned draft positions. */
export type StartDraftResult = { ok: true } | { ok: false; error: string };

export async function startDraft(seasonId: string): Promise<StartDraftResult> {
  const season = await getSeasonStatus(seasonId);
  if (!season) return { ok: false, error: "Season not found." };
  if (season.status !== "ready") {
    return { ok: false, error: "The draft can't be started right now." };
  }
  await query("UPDATE pool_seasons SET status = 'drafting', draft_started_at = now() WHERE id = $1", [seasonId]);
  await logEvent(seasonId, "start");
  return { ok: true };
}

async function getDraftOrder(seasonId: string): Promise<string[]> {
  const managers = await getSeasonManagers(seasonId);
  if (managers.length !== 10) return []; // not seeded yet (season isn't 'ready' or later)
  return buildDraftOrder(managers.map((m) => m.userId));
}

/** Highest Vegas win-total team still available — the auto-pick fallback for a blown deadline. */
function bestAvailableTeam(takenAbs: Set<string>): string {
  const available = TEAMS.filter((t) => !takenAbs.has(t.ab));
  available.sort((a, b) => b.ou - a.ou || a.ab.localeCompare(b.ab));
  return available[0].ab;
}

/** When the slot at `pickCount` (0-indexed picks made so far) went on the clock — the previous
 * pick's timestamp, or the draft's start time for the very first pick. Null if not started. */
async function clockStartedAt(seasonId: string, pickCount: number, season: SeasonStatusRow): Promise<Date | null> {
  if (pickCount === 0) {
    return season.draft_started_at ? new Date(season.draft_started_at) : null;
  }
  const rows = await query<{ created_at: string }>(
    "SELECT created_at FROM season_picks WHERE season_id = $1 AND pick_no = $2",
    [seasonId, pickCount],
  );
  return rows[0] ? new Date(rows[0].created_at) : null;
}

async function getCurrentDeadline(seasonId: string, season: SeasonStatusRow, picks: Pick[]): Promise<string | null> {
  if (picks.length >= TOTAL_PICKS) return null;
  const startedAt = await clockStartedAt(seasonId, picks.length, season);
  if (!startedAt) return null;
  return new Date(startedAt.getTime() + season.pick_clock_seconds * 1000).toISOString();
}

/** Auto-picks (highest available O/U) for anyone who's blown their pick-clock deadline —
 * possibly several picks in a row if nobody's checked the app in a while. Runs lazily whenever
 * draft state is read, same as the legacy single-tenant version. */
async function resolveOverduePicks(seasonId: string): Promise<void> {
  for (let guard = 0; guard < TOTAL_PICKS; guard++) {
    const season = await getSeasonStatus(seasonId);
    if (!season || season.status !== "drafting") return;
    const picks = await getSeasonPicks(seasonId);
    if (picks.length >= TOTAL_PICKS) return;
    const startedAt = await clockStartedAt(seasonId, picks.length, season);
    if (!startedAt || Date.now() - startedAt.getTime() < season.pick_clock_seconds * 1000) return;

    const draftOrder = await getDraftOrder(seasonId);
    const onClock = draftOrder[picks.length];
    const takenAbs = new Set(picks.map((p) => p.teamAb));
    const teamAb = bestAvailableTeam(takenAbs);
    const pickNo = picks.length + 1;
    try {
      await query("INSERT INTO season_picks (season_id, pick_no, user_id, team_ab, auto) VALUES ($1, $2, $3, $4, true)", [
        seasonId,
        pickNo,
        onClock,
        teamAb,
      ]);
    } catch (err) {
      if ((err as { code?: string }).code === "23505") continue; // someone else's request just filled it
      throw err;
    }
    await logEvent(seasonId, "auto_pick", { pickNo, userId: onClock, teamAb });
    if (pickNo === TOTAL_PICKS) {
      await query("UPDATE pool_seasons SET status = 'in_season', draft_completed_at = now() WHERE id = $1", [seasonId]);
    }
    // loop: the next slot may *also* be overdue after a long absence
  }
}

export type SubmitPickResult = ({ ok: true } & DraftStatePayload) | { ok: false; error: string; status: number };

/** Server-authoritative pick submission — re-validates turn order and team availability against
 * the DB, not whatever the client believes, since multiple people can be picking from different
 * devices at once. */
export async function submitPick(seasonId: string, userId: string, teamAb: string): Promise<SubmitPickResult> {
  await resolveOverduePicks(seasonId); // in case this slot itself just timed out

  const season = await getSeasonStatus(seasonId);
  if (!season || season.status !== "drafting") {
    return { ok: false, error: "The draft isn't running right now.", status: 403 };
  }
  const [picks, draftOrder] = await Promise.all([getSeasonPicks(seasonId), getDraftOrder(seasonId)]);
  if (picks.length >= TOTAL_PICKS) {
    return { ok: false, error: "The draft is already complete.", status: 409 };
  }
  const onClock = draftOrder[picks.length];
  if (userId !== onClock) {
    return { ok: false, error: "It's not your turn.", status: 403 };
  }
  if (picks.some((p) => p.teamAb === teamAb)) {
    return { ok: false, error: "That team's already been drafted.", status: 409 };
  }

  const pickNo = picks.length + 1;
  try {
    await query("INSERT INTO season_picks (season_id, pick_no, user_id, team_ab) VALUES ($1, $2, $3, $4)", [
      seasonId,
      pickNo,
      userId,
      teamAb,
    ]);
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return { ok: false, error: "Someone else just picked — refresh and try again.", status: 409 };
    }
    throw err;
  }
  await logEvent(seasonId, "pick", { pickNo, userId, teamAb });
  if (pickNo === TOTAL_PICKS) {
    await query("UPDATE pool_seasons SET status = 'in_season', draft_completed_at = now() WHERE id = $1", [seasonId]);
  }
  return { ok: true, ...(await getFullState(seasonId)) };
}

export type DraftStatePayload = {
  picks: Pick[];
  status: string;
  order: string[];
  deadline: string | null;
  pickClockSeconds: number;
};

/** Called by the state-polling endpoint (and after every pick) so overdue auto-picks land even
 * if nobody's actively picking right now, and every client sees the same on-the-clock deadline. */
export async function getFullState(seasonId: string): Promise<DraftStatePayload> {
  await resolveOverduePicks(seasonId);
  const season = await getSeasonStatus(seasonId);
  if (!season) return { picks: [], status: "filling", order: [], deadline: null, pickClockSeconds: 43200 };
  const [picks, order] = await Promise.all([getSeasonPicks(seasonId), getDraftOrder(seasonId)]);
  const deadline = await getCurrentDeadline(seasonId, season, picks);
  return { picks, status: season.status, order, deadline, pickClockSeconds: season.pick_clock_seconds };
}
