import "server-only";
import { randomInt } from "crypto";
import { query } from "./db";
import { buildDraftOrder, TOTAL_PICKS, type Pick } from "./draft";
import { MANAGER_NAMES } from "./managers";
import { TEAMS } from "./teams";

// 24h by default — pick within a day or the highest Vegas O/U team gets taken for you.
// Overridable via env var (e.g. for a faster deadline during a live draft night, or testing).
const AUTO_PICK_TIMEOUT_MS = Number(process.env.AUTO_PICK_TIMEOUT_MS) || 24 * 60 * 60 * 1000;

export async function getPicks(): Promise<Pick[]> {
  const rows = await query<{ pick_no: number; manager: string; team_ab: string }>(
    "SELECT pick_no, manager, team_ab FROM draft_picks ORDER BY pick_no ASC",
  );
  return rows.map((r) => ({ pickNo: r.pick_no, manager: r.manager, teamAb: r.team_ab }));
}

export async function isDraftStarted(): Promise<boolean> {
  const rows = await query<{ started_at: string | null }>("SELECT started_at FROM draft_meta WHERE id = 1");
  return Boolean(rows[0]?.started_at);
}

export async function startDraft(): Promise<void> {
  await query(
    `INSERT INTO draft_meta (id, started_at) VALUES (1, now())
     ON CONFLICT (id) DO UPDATE SET started_at = now()`,
  );
}

/** Fisher-Yates using crypto.randomInt — same approach used to pick the very first draft order. */
function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function savePositionOrder(order: string[]): Promise<void> {
  const values = order.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(", ");
  const params = order.flatMap((name, i) => [i + 1, name]);
  await query(
    `INSERT INTO draft_positions (position, manager) VALUES ${values}
     ON CONFLICT (position) DO UPDATE SET manager = EXCLUDED.manager`,
    params,
  );
}

/** Which manager holds each draft position (1-10) right now. Seeded with a random shuffle on
 * first-ever access; reshuffled every time the commissioner resets the draft. */
export async function getPositionOrder(): Promise<string[]> {
  const rows = await query<{ position: number; manager: string }>(
    "SELECT position, manager FROM draft_positions ORDER BY position ASC",
  );
  if (rows.length !== MANAGER_NAMES.length) {
    const shuffled = shuffle(MANAGER_NAMES);
    await savePositionOrder(shuffled);
    return shuffled;
  }
  return rows.map((r) => r.manager);
}

async function getDraftOrder(): Promise<string[]> {
  return buildDraftOrder(await getPositionOrder());
}

/** Highest Vegas win-total team still available — the auto-pick fallback for a blown deadline. */
function bestAvailableTeam(takenAbs: Set<string>): string {
  const available = TEAMS.filter((t) => !takenAbs.has(t.ab));
  available.sort((a, b) => b.ou - a.ou || a.ab.localeCompare(b.ab));
  return available[0].ab;
}

/** When the slot at `pickCount` (0-indexed picks made so far) went on the clock — the previous
 * pick's timestamp, or the draft's start time for the very first pick. Null if not started. */
async function clockStartedAt(pickCount: number): Promise<Date | null> {
  if (pickCount === 0) {
    const rows = await query<{ started_at: string | null }>("SELECT started_at FROM draft_meta WHERE id = 1");
    return rows[0]?.started_at ? new Date(rows[0].started_at) : null;
  }
  const rows = await query<{ created_at: string }>("SELECT created_at FROM draft_picks WHERE pick_no = $1", [pickCount]);
  return rows[0] ? new Date(rows[0].created_at) : null;
}

/** ISO deadline for the current on-the-clock pick, or null if the draft isn't running. */
export async function getCurrentDeadline(): Promise<string | null> {
  const picks = await getPicks();
  if (picks.length >= TOTAL_PICKS) return null;
  const startedAt = await clockStartedAt(picks.length);
  if (!startedAt) return null;
  return new Date(startedAt.getTime() + AUTO_PICK_TIMEOUT_MS).toISOString();
}

/** Auto-picks (highest available O/U) for anyone who's blown their 24h deadline — possibly
 * several picks in a row if nobody's checked the app in a while. There's no background worker
 * here, so this runs lazily whenever draft state is read (polled every few seconds while the
 * app is open) rather than on a fixed schedule. */
async function resolveOverduePicks(): Promise<void> {
  if (!(await isDraftStarted())) return;
  for (let guard = 0; guard < TOTAL_PICKS; guard++) {
    const picks = await getPicks();
    if (picks.length >= TOTAL_PICKS) return;
    const startedAt = await clockStartedAt(picks.length);
    if (!startedAt || Date.now() - startedAt.getTime() < AUTO_PICK_TIMEOUT_MS) return;

    const draftOrder = await getDraftOrder();
    const onClock = draftOrder[picks.length];
    const takenAbs = new Set(picks.map((p) => p.teamAb));
    const teamAb = bestAvailableTeam(takenAbs);
    const pickNo = picks.length + 1;
    try {
      await query("INSERT INTO draft_picks (pick_no, manager, team_ab) VALUES ($1, $2, $3)", [pickNo, onClock, teamAb]);
    } catch (err) {
      if ((err as { code?: string }).code === "23505") continue; // someone else's request just filled it
      throw err;
    }
    // loop: the next slot may *also* be overdue after a long absence
  }
}

export type SubmitPickResult = ({ ok: true } & DraftStatePayload) | { ok: false; error: string; status: number };

/** Server-authoritative pick submission — re-validates turn order and team availability
 * against the DB, not whatever the client believes, since multiple people can be picking
 * from different devices at once. */
export async function submitPick(manager: string, teamAb: string): Promise<SubmitPickResult> {
  if (!(await isDraftStarted())) {
    return { ok: false, error: "The commissioner hasn't started the draft yet.", status: 403 };
  }
  await resolveOverduePicks(); // in case this slot itself just timed out
  const [picks, draftOrder] = await Promise.all([getPicks(), getDraftOrder()]);
  if (picks.length >= TOTAL_PICKS) {
    return { ok: false, error: "The draft is already complete.", status: 409 };
  }
  const onClock = draftOrder[picks.length];
  if (manager !== onClock) {
    return { ok: false, error: `It's ${onClock}'s turn, not yours.`, status: 403 };
  }
  if (picks.some((p) => p.teamAb === teamAb)) {
    return { ok: false, error: "That team's already been drafted.", status: 409 };
  }

  const pickNo = picks.length + 1;
  try {
    await query("INSERT INTO draft_picks (pick_no, manager, team_ab) VALUES ($1, $2, $3)", [pickNo, manager, teamAb]);
  } catch (err) {
    // Unique-violation means someone else's request landed first for this slot/team — expected
    // under concurrent picking, not a bug. Let the client refetch and see the real state.
    if ((err as { code?: string }).code === "23505") {
      return { ok: false, error: "Someone else just picked — refresh and try again.", status: 409 };
    }
    throw err;
  }
  return { ok: true, ...(await getFullState()) };
}

export type DraftStatePayload = {
  picks: Pick[];
  started: boolean;
  order: string[];
  deadline: string | null;
};

/** Called by the state-polling endpoint (and after every pick) so overdue auto-picks land even
 * if nobody's actively picking right now — just has the page open — and every client gets the
 * same view of who holds which position and when the current pick times out. */
export async function getFullState(): Promise<DraftStatePayload> {
  await resolveOverduePicks();
  const [picks, started, order, deadline] = await Promise.all([
    getPicks(),
    isDraftStarted(),
    getPositionOrder(),
    getCurrentDeadline(),
  ]);
  return { picks, started, order, deadline };
}

/** Wipes picks, un-starts the draft, and reshuffles who holds which draft position. */
export async function resetPicks(): Promise<void> {
  await query("DELETE FROM draft_picks");
  await query("DELETE FROM draft_meta");
  await savePositionOrder(shuffle(MANAGER_NAMES));
}
