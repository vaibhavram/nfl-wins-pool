import { redirect, notFound } from "next/navigation";
import { requirePoolMembership } from "@/lib/pool-page-guard";
import { getPoolMembers } from "@/lib/pools-server";
import { getSeasonManagers } from "@/lib/season-server";
import { LobbyContent } from "./LobbyContent";

export default async function LobbyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, pool, membership, season } = await requirePoolMembership(slug);
  if (!season) notFound();

  // The lobby only makes sense once the pool has filled and draft positions are seeded ('ready')
  // -- earlier, invite/settings is where people wait; later, everyone belongs on /draft or the
  // post-draft tabs instead.
  if (season.status === "filling") redirect(`/p/${slug}/invite`);
  if (season.status === "drafting") redirect(`/p/${slug}/draft`);
  if (season.status === "in_season" || season.status === "final") redirect(`/p/${slug}/standings`);

  const [managers, members] = await Promise.all([getSeasonManagers(season.id), getPoolMembers(pool.id)]);
  const commissioner = members.find((m) => m.role === "commissioner");

  return (
    <LobbyContent
      slug={slug}
      poolName={pool.name}
      currentUserId={user.id}
      isCommissioner={membership.role === "commissioner"}
      managers={managers}
      commissionerName={commissioner?.display_name ?? pool.name}
    />
  );
}
