import "server-only";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "./auth/current-user";
import { getPoolBySlug, getMembership, getCurrentSeason, type PoolRow, type SeasonRow, type MemberRow } from "./pools-server";

export type PoolPageContext = { user: CurrentUser; pool: PoolRow; membership: MemberRow; season: SeasonRow | null };

/** Shared guard for every /p/[slug]/* in-pool screen: signed in, pool exists, caller is a
 * member. Doesn't redirect on season status -- callers decide what a null/early-status season
 * means for their screen (the lobby shows a waiting state; draft/leaderboard/etc. redirect
 * elsewhere). Mirrors lib/auth/require-member.ts's API-route version, but via redirect/notFound
 * instead of a JSON error. */
export async function requirePoolMembership(slug: string): Promise<PoolPageContext> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const pool = await getPoolBySlug(slug);
  if (!pool) notFound();

  const membership = await getMembership(pool.id, user.id);
  if (!membership) redirect("/pools");

  const season = await getCurrentSeason(pool.id);
  return { user, pool, membership, season };
}

/** For the post-draft screens (leaderboard/schedule/my-teams/draft-results/team/manager detail)
 * -- everyone belongs somewhere else until the draft's actually done, so this centralizes that
 * redirect chain instead of repeating it on every one of those pages. */
export async function requirePostDraftPool(slug: string): Promise<PoolPageContext & { season: SeasonRow }> {
  const ctx = await requirePoolMembership(slug);
  if (!ctx.season) notFound();
  if (ctx.season.status === "filling") redirect(`/p/${slug}/invite`);
  if (ctx.season.status === "ready") redirect(`/p/${slug}/lobby`);
  if (ctx.season.status === "drafting") redirect(`/p/${slug}/draft`);
  return ctx as PoolPageContext & { season: SeasonRow };
}
