import { requirePostDraftPool } from "@/lib/pool-page-guard";
import { getSeasonPicks, getSeasonManagers } from "@/lib/season-server";
import { rostersFromPicks } from "@/lib/draft";
import { ManagerRoster } from "@/components/pool/ManagerRoster";
import { PoolTabBar } from "@/components/pool/PoolTabBar";

export default async function MyTeamsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, season } = await requirePostDraftPool(slug);

  const [picks, managers] = await Promise.all([getSeasonPicks(season.id), getSeasonManagers(season.id)]);
  const rosters = rostersFromPicks(picks, managers.map((m) => m.userId));

  return (
    <div className="app-shell">
      <ManagerRoster slug={slug} userId={user.id} teams={rosters[user.id] ?? []} title="My teams" />
      <PoolTabBar slug={slug} />
    </div>
  );
}
