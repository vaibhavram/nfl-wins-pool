import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPoolBySlug, getMembership, getPoolMembers, getCurrentSeason } from "@/lib/pools-server";
import { listInvites } from "@/lib/invites-server";
import { SettingsContent } from "./SettingsContent";

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const pool = await getPoolBySlug(slug);
  if (!pool) notFound();

  const membership = await getMembership(pool.id, user.id);
  if (!membership) redirect("/pools");
  if (membership.role !== "commissioner") redirect(`/p/${slug}/invite`);

  const [members, invites, season] = await Promise.all([getPoolMembers(pool.id), listInvites(pool.id), getCurrentSeason(pool.id)]);

  return (
    <SettingsContent
      slug={slug}
      poolName={pool.name}
      draftStarted={season?.status !== "filling" && season?.status !== "ready"}
      pickClockSeconds={season?.pick_clock_seconds ?? 43200}
      scheduledDraftAt={season?.scheduled_draft_at ?? null}
      members={members.filter((m) => m.role !== "commissioner")}
      pendingInvites={invites.filter((i) => !i.accepted_at && !i.revoked_at).map((i) => ({ id: i.id, email: i.email! }))}
    />
  );
}
