import { requirePostDraftPool } from "@/lib/pool-page-guard";
import { getSeasonPicks, getSeasonManagers } from "@/lib/season-server";
import { TeamDetailContent } from "./TeamDetailContent";

export default async function TeamDetailPage({ params }: { params: Promise<{ slug: string; abbr: string }> }) {
  const { slug, abbr } = await params;
  const { season } = await requirePostDraftPool(slug);

  const [picks, managers] = await Promise.all([getSeasonPicks(season.id), getSeasonManagers(season.id)]);
  const nameByUserId = Object.fromEntries(managers.map((m) => [m.userId, m.displayName]));
  const ownerUserId = picks.find((p) => p.teamAb === abbr.toUpperCase())?.manager;

  return <TeamDetailContent slug={slug} abbr={abbr} ownerName={ownerUserId ? (nameByUserId[ownerUserId] ?? null) : null} />;
}
