"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InvitePreviewCard } from "./InvitePreviewCard";

export function JoinConfirm(props: { token: string; poolName: string; seasonYear: number; commissionerName: string; memberCount: number }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onJoin() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/invites/${props.token}/accept`, { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Couldn't join this pool.");
        setSubmitting(false);
        return;
      }
      router.push("/pools");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="app-shell" style={{ justifyContent: "center", padding: "0 24px 90px", gap: 22 }}>
      <InvitePreviewCard poolName={props.poolName} seasonYear={props.seasonYear} commissionerName={props.commissionerName} memberCount={props.memberCount} />
      {error && <div style={{ fontSize: 13, color: "var(--color-accent-300)", lineHeight: 1.5 }}>{error}</div>}
      <button className="btn btn-primary btn-block" style={{ minHeight: 46, fontSize: 15 }} onClick={onJoin} disabled={submitting}>
        {submitting ? "Joining…" : "Join pool"}
      </button>
    </div>
  );
}
