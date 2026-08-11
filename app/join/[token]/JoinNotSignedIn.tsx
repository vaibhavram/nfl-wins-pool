"use client";

import { useState, type FormEvent } from "react";
import { InvitePreviewCard } from "./InvitePreviewCard";

export function JoinNotSignedIn(props: { token: string; poolName: string; seasonYear: number; commissionerName: string; memberCount: number }) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose: "join_pool", redirectTo: `/join/${props.token}` }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Something went wrong.");
        setSubmitting(false);
        return;
      }
      setSent(true);
      setSubmitting(false);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="app-shell" style={{ justifyContent: "center", padding: "0 24px 90px", gap: 22 }}>
      <InvitePreviewCard poolName={props.poolName} seasonYear={props.seasonYear} commissionerName={props.commissionerName} memberCount={props.memberCount} />
      {sent ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 20, color: "var(--color-text)" }}>Check your email</h3>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "var(--color-neutral-400)" }}>
            We sent a link to <span style={{ color: "var(--color-text)" }}>{email}</span>. Click it and you&apos;ll land right back here, signed in.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "var(--color-neutral-400)" }}>
            Sign in to claim your seat. We&apos;ll bring you right back here.
          </p>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>
          {error && <div style={{ fontSize: 13, color: "var(--color-accent-300)", lineHeight: 1.5 }}>{error}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={!email.trim() || submitting}>
            {submitting ? "Sending…" : "Email me a link & join"}
          </button>
        </form>
      )}
    </div>
  );
}
