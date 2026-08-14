"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function OnboardingForm({
  redirectTo,
  initialDisplayName,
  initialUsername,
  initialPhone,
}: {
  redirectTo: string;
  initialDisplayName: string;
  initialUsername: string;
  initialPhone: string;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [username, setUsername] = useState(initialUsername);
  const [phone, setPhone] = useState(initialPhone);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, username, phone }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Something went wrong.");
        setSubmitting(false);
        return;
      }
      router.push(redirectTo);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="app-shell" style={{ justifyContent: "center", padding: "0 28px 80px", gap: 28 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ width: 40, height: 3, background: "var(--color-accent)", borderRadius: 2 }} />
        <h2 style={{ fontSize: 28, margin: 0, color: "var(--color-text)" }}>Tell us about you</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--color-neutral-400)" }}>
          This is how you&apos;ll show up on standings and rosters. Takes a second.
        </p>
      </div>
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="field">
          <label htmlFor="displayName">Name</label>
          <input
            id="displayName"
            className="input"
            type="text"
            autoComplete="name"
            placeholder="Your name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoFocus
            maxLength={60}
          />
        </div>
        <div className="field">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            className="input"
            type="text"
            autoComplete="off"
            placeholder="yourname"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={20}
          />
        </div>
        <div className="field">
          <label htmlFor="phone">Phone number</label>
          <input
            id="phone"
            className="input"
            type="tel"
            autoComplete="tel"
            placeholder="(555) 555-5555"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={20}
          />
        </div>
        {error && <div style={{ fontSize: 13, color: "var(--color-accent-300)", lineHeight: 1.5 }}>{error}</div>}
        <button
          className="btn btn-primary btn-block"
          type="submit"
          disabled={!displayName.trim() || !username.trim() || submitting}
        >
          {submitting ? "Saving…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
