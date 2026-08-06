import "server-only";
import { query } from "./db";
import { DRAFT_ORDER, TOTAL_PICKS, type Pick } from "./draft";

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

export type SubmitPickResult = { ok: true; picks: Pick[] } | { ok: false; error: string; status: number };

/** Server-authoritative pick submission — re-validates turn order and team availability
 * against the DB, not whatever the client believes, since multiple people can be picking
 * from different devices at once. */
export async function submitPick(manager: string, teamAb: string): Promise<SubmitPickResult> {
  if (!(await isDraftStarted())) {
    return { ok: false, error: "The commissioner hasn't started the draft yet.", status: 403 };
  }
  const picks = await getPicks();
  if (picks.length >= TOTAL_PICKS) {
    return { ok: false, error: "The draft is already complete.", status: 409 };
  }
  const onClock = DRAFT_ORDER[picks.length];
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
  return { ok: true, picks: await getPicks() };
}

/** Wipes picks and the started flag — back to a fresh, un-started lobby. */
export async function resetPicks(): Promise<void> {
  await query("DELETE FROM draft_picks");
  await query("DELETE FROM draft_meta");
}
