"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SeasonProvider, useSeason } from "@/components/pool/SeasonProvider";
import { usePoolPresence } from "@/lib/client/pool-live-data";
import { SignOutButton } from "@/components/SignOutButton";
import { buildDraftOrder } from "@/lib/draft";
import type { SeasonManager } from "@/lib/season-server";

function LobbyInner({
  slug,
  currentUserId,
  isCommissioner,
  managers,
  commissionerName,
}: {
  slug: string;
  currentUserId: string;
  isCommissioner: boolean;
  managers: SeasonManager[];
  commissionerName: string;
}) {
  const router = useRouter();
  const { draftStarted, draftComplete, startDraft } = useSeason();
  const online = usePoolPresence(slug);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draftOrder30 = useMemo(() => buildDraftOrder(managers.map((m) => m.userId)), [managers]);
  function pickNumbersFor(userId: string): number[] {
    return draftOrder30.reduce<number[]>((acc, uid, i) => {
      if (uid === userId) acc.push(i + 1);
      return acc;
    }, []);
  }

  // Everyone gets taken to the draft board automatically the moment the commissioner starts it.
  useEffect(() => {
    if (draftStarted && !draftComplete) router.push(`/p/${slug}/draft`);
    if (draftComplete) router.push(`/p/${slug}/leaderboard`);
  }, [draftStarted, draftComplete, router, slug]);

  async function onStart() {
    setBusy(true);
    setError(null);
    const result = await startDraft();
    setBusy(false);
    if (result.ok) router.push(`/p/${slug}/draft`);
    else setError(result.error);
  }

  return (
    <div className="app-shell" style={{ padding: "0 0 0" }}>
      <div style={{ padding: "20px 20px 4px", display: "flex", flexDirection: "column", gap: 3 }}>
        <h4 style={{ margin: 0, fontSize: 19, color: "var(--color-text)" }}>Draft lobby</h4>
        <div style={{ fontSize: 12.5, color: "var(--color-neutral-500)" }}>3 rounds · 10 managers</div>
      </div>
      <div
        style={{
          margin: "12px 20px 14px",
          padding: 14,
          borderRadius: "var(--radius-md)",
          background: "var(--color-accent-900)",
          border: "1px solid var(--color-accent-700)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--color-accent-300)" }}>
          Draft order
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--color-accent-200)" }}>
          Each draft position below gets 3 picks, spread across the board (e.g. 1st, 20th, and 26th overall) instead of a
          straight snake — so no position is systematically stronger. From{" "}
          <a
            href="https://grantland.com/the-triangle/you-should-have-an-nfl-wins-pool/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--color-accent-300)", textDecoration: "underline" }}
          >
            the original Grantland pitch
          </a>
          .
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "0 20px 16px" }} className="scr">
        <div style={{ fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-neutral-600)", marginBottom: 8 }}>
          Round 1 order
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {managers.map((m) => {
            const isMe = m.userId === currentUserId;
            return (
              <div
                key={m.userId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "11px 12px",
                  borderRadius: "var(--radius-md)",
                  background: isMe ? "var(--color-accent-900)" : "var(--color-surface)",
                  border: isMe ? "1px solid var(--color-accent-700)" : "1px solid transparent",
                  boxShadow: isMe ? "none" : "var(--shadow-sm)",
                }}
              >
                <div style={{ width: 22, fontFamily: "ui-monospace,monospace", fontSize: 13, color: isMe ? "var(--color-accent-400)" : "var(--color-neutral-500)" }}>
                  {m.draftPosition}
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <div style={{ fontSize: 15, color: isMe ? "var(--color-accent-200)" : "var(--color-text)" }}>
                    {m.displayName} {isMe && "(you)"}
                  </div>
                  <div style={{ fontSize: 11.5, fontFamily: "ui-monospace,monospace", color: isMe ? "var(--color-accent-400)" : "var(--color-neutral-500)" }}>
                    Picks {pickNumbersFor(m.userId).join(", ")}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "none" }}>
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: online.has(m.userId) ? "var(--color-accent)" : "var(--color-neutral-700)",
                    }}
                  />
                  <div style={{ fontSize: 11.5, color: online.has(m.userId) ? "var(--color-accent-300)" : "var(--color-neutral-600)" }}>
                    {online.has(m.userId) ? "Signed in" : "Offline"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div
        style={{
          flex: "none",
          padding: "12px 20px 30px",
          borderTop: "1px solid var(--color-divider)",
          background: "var(--color-bg)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {draftStarted ? (
          <div
            style={{
              textAlign: "center",
              padding: "13px 12px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-accent-700)",
              background: "var(--color-accent-900)",
              fontSize: 14,
              color: "var(--color-accent-200)",
            }}
          >
            Draft started — taking you there…
          </div>
        ) : isCommissioner ? (
          <button className="btn btn-primary btn-block" style={{ minHeight: 48, fontSize: 15, marginTop: 0 }} onClick={onStart} disabled={busy}>
            {busy ? "Starting…" : "Start the draft"}
          </button>
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: "13px 12px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-divider)",
              fontSize: 14,
              color: "var(--color-neutral-500)",
            }}
          >
            Waiting for {commissionerName} to start the draft
          </div>
        )}
        {error && <div style={{ fontSize: 12.5, color: "var(--color-accent-300)", textAlign: "center" }}>{error}</div>}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}

export function LobbyContent(props: {
  slug: string;
  currentUserId: string;
  isCommissioner: boolean;
  managers: SeasonManager[];
  commissionerName: string;
}) {
  return (
    <SeasonProvider slug={props.slug}>
      <LobbyInner {...props} />
    </SeasonProvider>
  );
}
