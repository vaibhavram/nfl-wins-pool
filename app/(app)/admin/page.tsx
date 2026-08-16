import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isAdminEmail, getAdminStats, getPoolsByStatus, getSignupsByDay, getRecentActivity, getStalledPools } from "@/lib/admin-server";

const STATUS_LABELS: Record<string, string> = {
  filling: "Filling",
  ready: "Ready",
  drafting: "Drafting",
  in_season: "In season",
  final: "Complete",
};

const EVENT_LABELS: Record<string, string> = {
  signup: "Signup",
  pool_created: "Pool",
  draft_started: "Draft started",
  draft_completed: "Draft done",
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ flex: 1, minWidth: 110, padding: 14, borderRadius: "var(--radius-md)", background: "var(--color-surface)", border: "1px solid var(--color-divider)" }}>
      <div style={{ fontFamily: "var(--font-heading)", fontSize: 24, color: "var(--color-text)" }}>{value}</div>
      <div style={{ fontSize: 11.5, color: "var(--color-neutral-500)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) redirect("/pools");

  const [stats, byStatus, signups, activity, stalled] = await Promise.all([
    getAdminStats(),
    getPoolsByStatus(),
    getSignupsByDay(),
    getRecentActivity(),
    getStalledPools(),
  ]);

  const maxSignupDay = Math.max(1, ...signups.map((d) => d.count));
  const maxStatusCount = Math.max(1, ...byStatus.map((s) => s.count));

  return (
    <>
      <div style={{ flex: "none", padding: "20px 20px 4px" }}>
        <h4 style={{ margin: 0, fontSize: 19, color: "var(--color-text)" }}>Admin</h4>
        <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>Read-only. Visible to nobody but you.</div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "14px 20px 30px", display: "flex", flexDirection: "column", gap: 22 }} className="scr">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <StatCard label="Total users" value={stats.totalUsers} />
          <StatCard label="Total pools" value={stats.totalPools} />
          <StatCard label="Drafting now" value={stats.poolsDrafting} />
          <StatCard label="In season" value={stats.poolsInSeason} />
          <StatCard label="Seats filled" value={`${stats.seatsFilled}/${stats.seatsTotal}`} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>
            Signups, last 30 days
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 56, padding: "0 2px" }}>
            {signups.map((d) => (
              <div
                key={d.day}
                title={`${d.day}: ${d.count}`}
                style={{
                  flex: 1,
                  height: `${Math.max((d.count / maxSignupDay) * 100, d.count > 0 ? 6 : 2)}%`,
                  background: d.count > 0 ? "var(--color-accent)" : "var(--color-neutral-800)",
                  borderRadius: 2,
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--color-neutral-600)" }}>
            <span>{signups[0]?.day}</span>
            <span>{signups[signups.length - 1]?.day}</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>
            Pools by status
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {byStatus.map((s) => (
              <div key={s.status} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 74, fontSize: 12.5, color: "var(--color-neutral-400)" }}>{STATUS_LABELS[s.status]}</div>
                <div style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--color-neutral-900)", overflow: "hidden" }}>
                  <div style={{ width: `${(s.count / maxStatusCount) * 100}%`, height: "100%", background: "var(--color-accent)" }} />
                </div>
                <div style={{ width: 20, textAlign: "right", fontSize: 12.5, fontFamily: "ui-monospace,monospace", color: "var(--color-text)" }}>
                  {s.count}
                </div>
              </div>
            ))}
          </div>
        </div>

        {stalled.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>
              Stalled pools
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {stalled.map((p) => (
                <div
                  key={p.slug}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "9px 12px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-accent-700)",
                    background: "var(--color-accent-900)",
                  }}
                >
                  <span style={{ fontSize: 13, color: "var(--color-accent-200)" }}>{p.name}</span>
                  <span style={{ fontSize: 12, color: "var(--color-accent-400)" }}>{p.reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>
            Recent activity
          </div>
          {activity.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>Nothing yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {activity.map((e, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 10,
                    padding: "8px 12px",
                    borderRadius: "var(--radius-md)",
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-divider)",
                  }}
                >
                  <div
                    style={{
                      flex: "none",
                      fontSize: 10,
                      letterSpacing: ".04em",
                      textTransform: "uppercase",
                      color: "var(--color-accent-300)",
                      width: 96,
                    }}
                  >
                    {EVENT_LABELS[e.type]}
                  </div>
                  <div style={{ flex: 1, fontSize: 13, color: "var(--color-text)", minWidth: 0 }}>{e.label}</div>
                  <div style={{ flex: "none", fontSize: 11, color: "var(--color-neutral-600)" }}>
                    {new Date(e.at).toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
