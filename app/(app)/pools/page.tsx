import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getUserPools, type PoolCard } from "@/lib/dashboard-server";
import { SignOutButton } from "@/components/SignOutButton";

function poolHref(slug: string, status: PoolCard["status"]): string {
  switch (status) {
    case "filling":
      return `/p/${slug}/invite`;
    case "ready":
      return `/p/${slug}/lobby`;
    case "drafting":
      return `/p/${slug}/draft`;
    case "in_season":
    case "final":
      return `/p/${slug}/standings`;
  }
}

function statusLabel(status: PoolCard["status"], memberCount: number): { label: string; color: string } {
  switch (status) {
    case "filling":
      return { label: `${memberCount}/10 joined`, color: "var(--color-neutral-400)" };
    case "ready":
      return { label: "Ready to draft", color: "var(--color-accent-300)" };
    case "drafting":
      return { label: "Drafting", color: "var(--color-accent-300)" };
    case "in_season":
      return { label: "In season", color: "var(--color-accent-300)" };
    case "final":
      return { label: "Final", color: "var(--color-neutral-500)" };
  }
}

export default async function PoolsPage() {
  const user = await getCurrentUser();
  const pools = user ? await getUserPools(user.id) : [];

  return (
    <>
      <div style={{ flex: "none", padding: "20px 20px 4px", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <h4 style={{ margin: 0, fontSize: 19, color: "var(--color-text)" }}>Your pools</h4>
          <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>{user?.email}</div>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "14px 20px 14px" }} className="scr">
        {pools.length === 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 40,
              textAlign: "center",
              color: "var(--color-neutral-500)",
              fontSize: 14,
            }}
          >
            No pools yet. Create one or join with an invite link.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pools.map((p) => {
              const { label, color } = statusLabel(p.status, p.memberCount);
              return (
                <Link
                  key={p.id}
                  href={poolHref(p.slug, p.status)}
                  style={{
                    display: "block",
                    padding: 13,
                    borderRadius: "var(--radius-md)",
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-divider)",
                    textDecoration: "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontSize: 15.5, color: "var(--color-text)" }}>{p.name}</div>
                    {p.role === "commissioner" && (
                      <div
                        style={{
                          fontSize: 10,
                          letterSpacing: ".06em",
                          textTransform: "uppercase",
                          color: "var(--color-accent-300)",
                        }}
                      >
                        Commissioner
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                    <div style={{ fontSize: 12.5, color: "var(--color-neutral-500)" }}>{p.seasonYear}</div>
                    <div style={{ fontSize: 12.5, color }}>{label}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      <div
        style={{
          flex: "none",
          padding: "12px 20px 30px",
          borderTop: "1px solid var(--color-divider)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/pools/new" className="btn btn-primary" style={{ flex: 1, minHeight: 44, fontSize: 14 }}>
            Create a pool
          </Link>
          <Link href="/join" className="btn btn-secondary" style={{ flex: 1, minHeight: 44, fontSize: 14 }}>
            Join a pool
          </Link>
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <SignOutButton />
        </div>
      </div>
    </>
  );
}
