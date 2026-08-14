"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MemberRow } from "@/lib/pools-server";

type EmailInvite = { id: string; email: string | null; accepted: boolean };

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function InviteContent({
  slug,
  poolName,
  members,
  shareToken,
  emailInvites: initialEmailInvites,
  isCommissioner,
}: {
  slug: string;
  poolName: string;
  members: MemberRow[];
  shareToken: string;
  emailInvites: EmailInvite[];
  isCommissioner: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailInvites, setEmailInvites] = useState(initialEmailInvites);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    // Building the full URL needs window.location, which doesn't exist during the server render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShareUrl(`${window.location.origin}/join/${shareToken}`);
  }, [shareToken]);
  const pendingInvites = emailInvites.filter((i) => !i.accepted);
  const seatsLeft = Math.max(0, 10 - members.length);
  const openSeatPlaceholders = Math.max(0, seatsLeft - pendingInvites.length);

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function shareLink() {
    if (navigator.share) {
      await navigator.share({ title: `Join ${poolName}`, url: shareUrl }).catch(() => {});
    } else {
      await copyLink();
    }
  }

  async function sendEmailInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const res = await fetch(`/api/p/${slug}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Couldn't send that invite.");
        setSending(false);
        return;
      }
      setEmailInvites((prev) => [{ id: data.invite.id, email: data.invite.email, accepted: false }, ...prev]);
      setEmail("");
      setSending(false);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setSending(false);
    }
  }

  return (
    <>
      <div style={{ flex: "none", padding: "10px 20px 14px", borderBottom: "1px solid var(--color-divider)", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/pools" className="btn btn-ghost" style={{ paddingLeft: 0, fontSize: 14, display: "inline-flex" }}>
            ← Your pools
          </Link>
          {isCommissioner && (
            <Link href={`/p/${slug}/settings`} className="btn btn-ghost btn-icon" style={{ fontSize: 15 }}>
              ⚙
            </Link>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h4 style={{ margin: 0, fontSize: 19, color: "var(--color-text)" }}>{poolName}</h4>
          <div style={{ fontFamily: "var(--font-heading)", fontSize: 15, color: "var(--color-accent-200)" }}>{members.length} / 10</div>
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={i}
              style={{ flex: 1, height: 4, borderRadius: 2, background: i < members.length ? "var(--color-accent-600)" : "var(--color-neutral-800)" }}
            />
          ))}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--color-neutral-500)" }}>
          {seatsLeft === 0 ? "All 10 seats filled." : `${seatsLeft} seat${seatsLeft === 1 ? "" : "s"} left. The draft can't start until all ten are in.`}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "12px 16px 14px", display: "flex", flexDirection: "column", gap: 16 }} className="scr">
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>Invite link</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 12px", borderRadius: "var(--radius-md)", background: "var(--color-surface)", border: "1px solid var(--color-divider)" }}>
            <div style={{ flex: 1, minWidth: 0, fontFamily: "ui-monospace,monospace", fontSize: 12, color: "var(--color-neutral-300)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {shareUrl.replace(/^https?:\/\//, "")}
            </div>
            <button className="btn btn-secondary" style={{ minHeight: 32, paddingInline: 12, fontSize: 12.5 }} onClick={copyLink}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button className="btn btn-primary btn-block" style={{ minHeight: 44, fontSize: 14, marginTop: 0 }} onClick={shareLink}>
            Share link
          </button>
        </div>

        <form onSubmit={sendEmailInvite} style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>Or invite by email</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="input"
              style={{ flex: 1, minHeight: 44, fontSize: 14 }}
              type="email"
              placeholder="friend@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="btn btn-secondary" style={{ minHeight: 44, paddingInline: 14, fontSize: 13.5 }} type="submit" disabled={!email.trim() || sending}>
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
          {error && <div style={{ fontSize: 12.5, color: "var(--color-accent-300)" }}>{error}</div>}
        </form>

        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <div style={{ fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>Members</div>
            <div style={{ fontSize: 11.5, color: "var(--color-neutral-600)" }}>
              {members.length} in{pendingInvites.length > 0 ? ` · ${pendingInvites.length} pending` : ""}
            </div>
          </div>
          {members.map((m) => (
            <div
              key={m.user_id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "10px 12px",
                borderRadius: "var(--radius-md)",
                background: m.role === "commissioner" ? "var(--color-accent-900)" : "var(--color-surface)",
                border: `1px solid ${m.role === "commissioner" ? "var(--color-accent-700)" : "var(--color-divider)"}`,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: m.role === "commissioner" ? "var(--color-accent-800)" : "var(--color-neutral-800)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10.5,
                  color: m.role === "commissioner" ? "var(--color-accent-200)" : "var(--color-neutral-300)",
                  flex: "none",
                }}
              >
                {initials(m.display_name)}
              </div>
              <div style={{ flex: 1, fontSize: 14.5, color: m.role === "commissioner" ? "var(--color-accent-200)" : "var(--color-text)" }}>
                {m.display_name}
              </div>
              <div style={{ fontSize: m.role === "commissioner" ? 11 : 11.5, letterSpacing: m.role === "commissioner" ? ".06em" : undefined, textTransform: m.role === "commissioner" ? "uppercase" : undefined, color: m.role === "commissioner" ? "var(--color-accent-300)" : "var(--color-accent-300)" }}>
                {m.role === "commissioner" ? "Commissioner" : "Joined"}
              </div>
            </div>
          ))}
          {pendingInvites.map((inv) => (
            <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: "var(--radius-md)", border: "1px dashed var(--color-neutral-800)" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", border: "1px dashed var(--color-neutral-800)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--color-neutral-700)", flex: "none" }}>
                ✉
              </div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: "var(--color-neutral-500)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {inv.email ?? "Pending invite"}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--color-neutral-600)" }}>Pending</div>
            </div>
          ))}
          {Array.from({ length: openSeatPlaceholders }, (_, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: "var(--radius-md)", border: "1px dashed var(--color-neutral-900)" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", border: "1px dashed var(--color-neutral-900)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "var(--color-neutral-700)", flex: "none" }}>
                +
              </div>
              <div style={{ flex: 1, fontSize: 13.5, color: "var(--color-neutral-600)" }}>Open seat</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
