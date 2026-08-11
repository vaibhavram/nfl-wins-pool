import "server-only";
import { query } from "./db2";

export type PoolCard = {
  id: string;
  slug: string;
  name: string;
  role: "commissioner" | "manager";
  seasonYear: number;
  status: "filling" | "ready" | "drafting" | "in_season" | "final";
  memberCount: number;
};

/** Every pool this user belongs to, newest first. Phase 2 only ever produces "filling"/"ready"
 * pools (nothing can transition further yet), but this reads whatever status actually exists so
 * it doesn't need changing again once Phase 3 adds the rest of the lifecycle. */
export async function getUserPools(userId: string): Promise<PoolCard[]> {
  return query<PoolCard>(
    `SELECT
       p.id, p.slug, p.name, pm.role,
       ps.season_year AS "seasonYear", ps.status,
       (SELECT count(*)::int FROM pool_members WHERE pool_id = p.id) AS "memberCount"
     FROM pool_members pm
     JOIN pools p ON p.id = pm.pool_id
     JOIN pool_seasons ps ON ps.pool_id = p.id
     WHERE pm.user_id = $1
     ORDER BY ps.season_year DESC, p.created_at DESC`,
    [userId],
  );
}
