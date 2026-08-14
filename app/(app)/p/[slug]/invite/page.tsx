import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPoolBySlug, getMembership, getPoolMembers } from "@/lib/pools-server";
import { getOrCreateShareLink, listInvites } from "@/lib/invites-server";
import { InviteContent } from "./InviteContent";

export default async function InvitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const pool = await getPoolBySlug(slug);
  if (!pool) notFound();

  const membership = await getMembership(pool.id, user.id);
  if (!membership) redirect("/pools");

  const isCommissioner = membership.role === "commissioner";
  const [members, shareLink, emailInvites] = await Promise.all([
    getPoolMembers(pool.id),
    getOrCreateShareLink(pool.id, user.id),
    listInvites(pool.id),
  ]);

  return (
    <InviteContent
      slug={slug}
      poolName={pool.name}
      members={members}
      shareToken={shareLink.token}
      emailInvites={emailInvites
        .filter((i) => !i.revoked_at)
        .map((i) => ({
          id: i.id,
          // Only the commissioner gets to see who was invited by email -- everyone else just
          // sees that a seat is pending.
          email: isCommissioner ? i.email! : null,
          accepted: Boolean(i.accepted_at),
        }))}
      isCommissioner={isCommissioner}
    />
  );
}
