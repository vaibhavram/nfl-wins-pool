import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/pools");

  return (
    <div className="app-shell">
      <div style={{ flex: "none", padding: "16px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--color-divider)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, border: "1px solid var(--color-accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "var(--color-accent-200)" }}>
            W
          </div>
          <div style={{ fontFamily: "var(--font-heading)", fontSize: 14.5, color: "var(--color-text)" }}>NFL Wins Pool</div>
        </div>
        <Link href="/sign-in" className="btn btn-ghost" style={{ fontSize: 13, padding: "6px 10px" }}>
          Sign in
        </Link>
      </div>

      <div style={{ flex: 1, overflow: "auto" }} className="scr">
        <div
          style={{
            padding: "44px 22px 40px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
            background: "radial-gradient(120% 80% at 15% 0%, rgba(145,132,217,.16), transparent 62%)",
          }}
        >
          <div style={{ width: 44, height: 3, background: "var(--color-accent)", borderRadius: 2 }} />
          <h2 style={{ margin: 0, fontFamily: "var(--font-heading)", fontSize: 32, lineHeight: 1.15, fontWeight: 500, color: "var(--color-text)" }}>
            Draft three NFL teams. Add up their wins.
          </h2>
          <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.55, color: "var(--color-neutral-400)" }}>
            The whole season in one number. Run a pool with your friends and watch the standings move every Sunday.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Link href="/sign-in" className="btn btn-primary btn-block" style={{ minHeight: 48, fontSize: 15 }}>
              Get started
            </Link>
            <div style={{ fontSize: 12, color: "var(--color-neutral-600)", textAlign: "center" }}>
              Free · email link to sign in, no password
            </div>
          </div>
        </div>

        <div style={{ padding: "26px 22px", borderTop: "1px solid var(--color-divider)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>
            What&apos;s a wins pool?
          </div>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "var(--color-neutral-300)" }}>
            You draft NFL <em style={{ fontStyle: "normal", color: "var(--color-accent-200)" }}>teams</em>, not players. No
            lineups to set, no waiver wire, nothing to check on Tuesday morning. Every regular-season win your three teams
            collect counts toward your total, and the highest total at the end of Week 18 wins the pool.
          </p>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--color-neutral-500)" }}>
            The idea comes from Bill Simmons, who laid out the format at Grantland in{" "}
            <a href="https://grantland.com/the-triangle/you-should-have-an-nfl-wins-pool/" target="_blank" rel="noopener noreferrer">
              You Should Have an NFL Wins Pool
            </a>
            . This is that pool, run for you.
          </p>
        </div>

        <div style={{ padding: "26px 22px", borderTop: "1px solid var(--color-divider)", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>How it works</div>
          {[
            ["Start a pool, invite nine friends", "Share one link. They're in as soon as they tap it."],
            ["Draft your three teams", "Take your turn whenever you're free — the draft waits for you."],
            ["Watch the leaderboard all season", "Scores update as games finish. Every game matters to somebody."],
          ].map(([title, body], i) => (
            <div key={title} style={{ display: "flex", gap: 14 }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  flex: "none",
                  borderRadius: "50%",
                  border: "1px solid var(--color-accent-700)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "ui-monospace,monospace",
                  fontSize: 12,
                  color: "var(--color-accent-200)",
                }}
              >
                {i + 1}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ fontSize: 15, color: "var(--color-text)" }}>{title}</div>
                <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--color-neutral-500)" }}>{body}</div>
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            margin: "0 22px 26px",
            padding: 18,
            borderRadius: "var(--radius-md)",
            background: "var(--color-surface)",
            border: "1px solid var(--color-divider)",
            display: "flex",
            flexDirection: "column",
            gap: 11,
          }}
        >
          <div style={{ fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>
            The format, plainly
          </div>
          {[
            ["Managers", "10"],
            ["Picks each", "3"],
            ["Teams drafted", "30 of 32"],
            ["Scoring", "Total wins"],
          ].map(([label, value], i, arr) => (
            <div
              key={label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13.5,
                color: "var(--color-neutral-300)",
                borderBottom: i < arr.length - 1 ? "1px solid var(--color-divider)" : "none",
                paddingBottom: i < arr.length - 1 ? 8 : 0,
              }}
            >
              <span>{label}</span>
              <span style={{ color: "var(--color-text)" }}>{value}</span>
            </div>
          ))}
          <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--color-neutral-600)" }}>
            One format, no settings to argue about. The draft order isn&apos;t a plain snake — it&apos;s balanced so an
            early first pick costs you later.
          </div>
        </div>

        <div
          style={{
            padding: "30px 22px 40px",
            borderTop: "1px solid var(--color-divider)",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            background: "radial-gradient(100% 70% at 80% 100%, rgba(145,132,217,.13), transparent 60%)",
          }}
        >
          <h3 style={{ margin: 0, fontFamily: "var(--font-heading)", fontSize: 20, fontWeight: 500, color: "var(--color-text)" }}>
            Ready when you are.
          </h3>
          <Link href="/sign-in" className="btn btn-primary btn-block" style={{ minHeight: 46, fontSize: 15 }}>
            Create your pool
          </Link>
        </div>
      </div>
    </div>
  );
}
