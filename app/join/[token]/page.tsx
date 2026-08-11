import { getCurrentUser } from "@/lib/auth/current-user";
import { getInvitePreview } from "@/lib/invites-server";
import { JoinNotSignedIn } from "./JoinNotSignedIn";
import { JoinConfirm } from "./JoinConfirm";

export default async function JoinTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [preview, user] = await Promise.all([getInvitePreview(token), getCurrentUser()]);

  if (!preview) {
    return (
      <div className="app-shell" style={{ justifyContent: "center", padding: "0 28px 90px", gap: 16, textAlign: "center" }}>
        <h3 style={{ margin: 0, fontSize: 22, color: "var(--color-text)" }}>This invite isn&apos;t valid</h3>
        <p style={{ margin: 0, fontSize: 14, color: "var(--color-neutral-400)" }}>It may have been revoked, or the link is incomplete.</p>
      </div>
    );
  }

  const shared = {
    token,
    poolName: preview.pool.name,
    seasonYear: preview.seasonYear,
    commissionerName: preview.commissionerName,
    memberCount: preview.memberCount,
  };

  return user ? <JoinConfirm {...shared} /> : <JoinNotSignedIn {...shared} />;
}
