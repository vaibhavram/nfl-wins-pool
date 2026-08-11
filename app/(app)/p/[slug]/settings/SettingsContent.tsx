"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { MemberRow } from "@/lib/pools-server";

type PendingInvite = { id: string; email: string };

export function SettingsContent({
  slug,
  poolName: initialName,
  draftStarted,
  members: initialMembers,
  pendingInvites: initialInvites,
}: {
  slug: string;
  poolName: string;
  draftStarted: boolean;
  members: MemberRow[];
  pendingInvites: PendingInvite[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [savingName, setSavingName] = useState(false);
  const [members, setMembers] = useState(initialMembers);
  const [invites, setInvites] = useState(initialInvites);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveName() {
    if (!name.trim()) return;
    setSavingName(true);
    const res = await fetch(`/api/p/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setSavingName(false);
    if (!data.ok) setError(data.error ?? "Couldn't save that name.");
    else router.refresh();
  }

  async function revokeInvite(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/p/${slug}/invites/${id}`, { method: "DELETE" });
    const data = await res.json();
    setBusyId(null);
    if (!data.ok) {
      setError(data.error ?? "Couldn't revoke that invite.");
      return;
    }
    setInvites((prev) => prev.filter((i) => i.id !== id));
  }

  async function removeMember(userId: string) {
    setBusyId(userId);
    const res = await fetch(`/api/p/${slug}/members/${userId}`, { method: "DELETE" });
    const data = await res.json();
    setBusyId(null);
    if (!data.ok) {
      setError(data.error ?? "Couldn't remove that member.");
      return;
    }
    setMembers((prev) => prev.filter((m) => m.user_id !== userId));
  }

  return (
    <>
      <div style={{ flex: "none", padding: "8px 18px 12px", borderBottom: "1px solid var(--color-divider)", display: "flex", alignItems: "center", gap: 10 }}>
        <Link href={`/p/${slug}/invite`} className="btn btn-ghost" style={{ paddingLeft: 0, fontSize: 14, display: "inline-flex" }}>
          ←
        </Link>
        <h4 style={{ margin: 0, fontSize: 18, color: "var(--color-text)" }}>Pool settings</h4>
        <div style={{ marginLeft: "auto", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--color-accent-200)", background: "var(--color-accent-900)", borderRadius: 3, padding: "2px 6px" }}>
          Commissioner
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "14px 18px 18px", display: "flex", flexDirection: "column", gap: 20 }} className="scr">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>Pool name</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="input" style={{ flex: 1, minHeight: 44, fontSize: 15 }} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            <button className="btn btn-secondary" style={{ minHeight: 44, paddingInline: 14, fontSize: 13.5 }} onClick={saveName} disabled={savingName || !name.trim() || name === initialName}>
              {savingName ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {error && <div style={{ fontSize: 12.5, color: "var(--color-accent-300)" }}>{error}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <div style={{ fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>Invites</div>
            <Link href={`/p/${slug}/invite`} style={{ fontSize: 12, color: "var(--color-accent-300)" }}>
              Invite more people
            </Link>
          </div>
          {invites.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>No pending invites.</div>
          ) : (
            invites.map((inv) => (
              <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: "var(--radius-md)", border: "1px dashed var(--color-neutral-800)" }}>
                <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: "var(--color-neutral-400)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {inv.email}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--color-neutral-600)" }}>Pending</div>
                <button className="btn btn-ghost" style={{ fontSize: 12, padding: "4px 6px" }} onClick={() => revokeInvite(inv.id)} disabled={busyId === inv.id}>
                  Revoke
                </button>
              </div>
            ))
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <div style={{ fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>Members</div>
            <div style={{ fontSize: 11.5, color: "var(--color-neutral-600)" }}>{draftStarted ? "Draft in progress" : "Draft not started"}</div>
          </div>
          {members.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>Just you so far.</div>
          ) : (
            members.map((m) => (
              <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: "var(--radius-md)", background: "var(--color-surface)", border: "1px solid var(--color-divider)" }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--color-neutral-800)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "var(--color-neutral-300)", flex: "none" }}>
                  {m.display_name.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, fontSize: 14, color: "var(--color-text)" }}>{m.display_name}</div>
                {!draftStarted && (
                  <button className="btn btn-ghost" style={{ fontSize: 12, padding: "4px 6px" }} onClick={() => removeMember(m.user_id)} disabled={busyId === m.user_id}>
                    Remove
                  </button>
                )}
              </div>
            ))
          )}
          {!draftStarted && <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--color-neutral-600)", paddingTop: 2 }}>Once the draft starts, members can&apos;t be removed.</div>}
        </div>
      </div>
    </>
  );
}
