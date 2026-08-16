import { requirePostDraftPool } from "@/lib/pool-page-guard";
import { getSeasonPicks, getSeasonManagers } from "@/lib/season-server";
import { rostersFromPicks } from "@/lib/draft";
import { ManagerRoster } from "@/components/pool/ManagerRoster";
import { PoolTabBar } from "@/components/pool/PoolTabBar";

export default async function MyTeamsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, pool, season, membership } = await requirePostDraftPool(slug);

  const [picks, managers] = await Promise.all([getSeasonPicks(season.id), getSeasonManagers(season.id)]);
  const rosters = rostersFromPicks(picks, managers.map((m) => m.userId));
  const draftReceipt = picks.filter((p) => p.manager === user.id).map((p) => ({ teamAb: p.teamAb, pickNo: p.pickNo }));

  return (
    <div className="app-shell">
      <ManagerRoster
        slug={slug}
        poolName={pool.name}
        userId={user.id}
        teams={rosters[user.id] ?? []}
        draftReceipt={draftReceipt}
        title="My teams"
        isCommissioner={membership.role === "commissioner"}
      />
      <PoolTabBar slug={slug} />
    </div>
  );
}
