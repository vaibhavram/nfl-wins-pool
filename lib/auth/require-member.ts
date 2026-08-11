import "server-only";
import { getCurrentUser, type CurrentUser } from "./current-user";
import { getPoolBySlug, getMembership, type PoolRow, type MemberRow } from "../pools-server";

export type MemberContext = { user: CurrentUser; pool: PoolRow; membership: MemberRow };

/** Resolves "is there a signed-in user, does this pool exist, and are they a member of it" in
 * one call -- every /api/p/[slug]/* route should go through this rather than checking
 * membership inline, since cross-pool data leakage is the single biggest risk in this rewrite. */
export async function requireMember(slug: string): Promise<MemberContext | { error: string; status: number }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in.", status: 401 };

  const pool = await getPoolBySlug(slug);
  if (!pool) return { error: "Pool not found.", status: 404 };

  const membership = await getMembership(pool.id, user.id);
  if (!membership) return { error: "You're not a member of this pool.", status: 403 };

  return { user, pool, membership };
}
