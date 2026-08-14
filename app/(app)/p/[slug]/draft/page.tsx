import { redirect, notFound } from "next/navigation";
import { requirePoolMembership } from "@/lib/pool-page-guard";
import { getPoolMembers } from "@/lib/pools-server";
import { getSeasonManagers } from "@/lib/season-server";
import { DraftContent } from "./DraftContent";

export default async function DraftPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, pool, season } = await requirePoolMembership(slug);
  if (!season) notFound();

  if (season.status === "filling") redirect(`/p/${slug}/invite`);
  if (season.status === "in_season" || season.status === "final") redirect(`/p/${slug}/standings`);

  const [managers, members] = await Promise.all([getSeasonManagers(season.id), getPoolMembers(pool.id)]);
  const commissioner = members.find((m) => m.role === "commissioner");

  return (
    <DraftContent
      slug={slug}
      currentUserId={user.id}
      managers={managers}
      commissionerName={commissioner?.display_name ?? pool.name}
    />
  );
}
