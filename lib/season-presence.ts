import "server-only";
import { query } from "./db2";

const ONLINE_WINDOW_SECONDS = 45;

export async function heartbeat(seasonId: string, userId: string): Promise<void> {
  await query(
    `INSERT INTO season_presence (season_id, user_id, last_seen) VALUES ($1, $2, now())
     ON CONFLICT (season_id, user_id) DO UPDATE SET last_seen = now()`,
    [seasonId, userId],
  );
}

export async function onlineUserIds(seasonId: string): Promise<string[]> {
  const rows = await query<{ user_id: string }>(
    "SELECT user_id FROM season_presence WHERE season_id = $1 AND last_seen > now() - make_interval(secs => $2)",
    [seasonId, ONLINE_WINDOW_SECONDS],
  );
  return rows.map((r) => r.user_id);
}
