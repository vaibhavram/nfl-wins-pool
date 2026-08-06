import "server-only";
import { query } from "./db";

const ONLINE_WINDOW_SECONDS = 45;

export async function heartbeat(manager: string): Promise<void> {
  await query(
    `INSERT INTO presence (manager, last_seen) VALUES ($1, now())
     ON CONFLICT (manager) DO UPDATE SET last_seen = now()`,
    [manager],
  );
}

export async function onlineManagers(): Promise<string[]> {
  const rows = await query<{ manager: string }>(
    "SELECT manager FROM presence WHERE last_seen > now() - make_interval(secs => $1)",
    [ONLINE_WINDOW_SECONDS],
  );
  return rows.map((r) => r.manager);
}
