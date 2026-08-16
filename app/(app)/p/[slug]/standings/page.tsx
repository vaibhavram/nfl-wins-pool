import { requirePostDraftPool } from "@/lib/pool-page-guard";
import { getSeasonPicks, getSeasonManagers } from "@/lib/season-server";
import { StandingsContent } from "./StandingsContent";

export default async function StandingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, pool, season, membership } = await requirePostDraftPool(slug);

  const [picks, managers] = await Promise.all([getSeasonPicks(season.id), getSeasonManagers(season.id)]);

  return (
    <StandingsContent
      slug={slug}
      poolName={pool.name}
      currentUserId={user.id}
      picks={picks}
      managers={managers}
      isCommissioner={membership.role === "commissioner"}
    />
  );
}
