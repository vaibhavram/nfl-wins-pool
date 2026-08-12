import Link from "next/link";
import { requirePostDraftPool } from "@/lib/pool-page-guard";
import { getSeasonPicks, getSeasonManagers } from "@/lib/season-server";
import { rostersFromPicks } from "@/lib/draft";
import { ManagerRoster } from "@/components/pool/ManagerRoster";
import { PoolTabBar } from "@/components/pool/PoolTabBar";

export default async function ManagerDetailPage({ params }: { params: Promise<{ slug: string; userId: string }> }) {
  const { slug, userId } = await params;
  const { user, season } = await requirePostDraftPool(slug);

  const [picks, managers] = await Promise.all([getSeasonPicks(season.id), getSeasonManagers(season.id)]);
  const target = managers.find((m) => m.userId === userId);

  if (!target) {
    return (
      <div className="app-shell" style={{ padding: 28 }}>
        <p>Unknown manager.</p>
        <Link href={`/p/${slug}/leaderboard`} className="btn btn-ghost">
          ← Back
        </Link>
      </div>
    );
  }

  const rosters = rostersFromPicks(picks, managers.map((m) => m.userId));
  const mine = userId === user.id;

  return (
    <div className="app-shell">
      <div style={{ padding: "16px 16px 0" }}>
        <Link href={`/p/${slug}/leaderboard`} className="btn btn-ghost" style={{ paddingLeft: 0, fontSize: 14 }}>
          ← Back
        </Link>
      </div>
      <ManagerRoster
        slug={slug}
        userId={userId}
        teams={rosters[userId] ?? []}
        title={mine ? `${target.displayName} (you)` : target.displayName}
      />
      <PoolTabBar slug={slug} />
    </div>
  );
}
