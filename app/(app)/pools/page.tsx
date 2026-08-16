import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getUserPools, getUserArchivedSeasons } from "@/lib/dashboard-server";
import { poolHref, statusLabel } from "@/lib/pool-status";
import { SignOutButton } from "@/components/SignOutButton";

export default async function PoolsPage() {
  const user = await getCurrentUser();
  const [pools, archived] = user
    ? await Promise.all([getUserPools(user.id), getUserArchivedSeasons(user.id)])
    : [[], []];

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
              const { label, color } = statusLabel(p);
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

        {archived.length > 0 && (
          <details style={{ marginTop: 16 }}>
            <summary style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--color-neutral-500)", cursor: "pointer" }}>
              Past seasons ({archived.length})
            </summary>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
              {archived.map((p) => {
                const { label } = statusLabel(p);
                return (
                  <Link
                    key={`${p.id}-${p.seasonYear}`}
                    href={poolHref(p.slug, p.status)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "10px 13px",
                      borderRadius: "var(--radius-md)",
                      border: "1px dashed var(--color-neutral-800)",
                      fontSize: 13,
                      color: "var(--color-neutral-400)",
                      textDecoration: "none",
                    }}
                  >
                    <span>
                      {p.name} · {p.seasonYear}
                    </span>
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          </details>
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
