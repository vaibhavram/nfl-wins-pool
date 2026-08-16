import { requirePostDraftPool } from "@/lib/pool-page-guard";
import { getSeasonPicks, getSeasonManagers } from "@/lib/season-server";
import { DraftResultsContent } from "./DraftResultsContent";

export default async function DraftResultsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, pool, season, membership } = await requirePostDraftPool(slug);

  const [picks, managers] = await Promise.all([getSeasonPicks(season.id), getSeasonManagers(season.id)]);

  return (
    <DraftResultsContent
      slug={slug}
      poolName={pool.name}
      currentUserId={user.id}
      picks={picks}
      managers={managers}
      isCommissioner={membership.role === "commissioner"}
    />
  );
}
