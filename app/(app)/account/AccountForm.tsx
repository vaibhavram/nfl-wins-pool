"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function AccountForm({
  initialDisplayName,
  initialUsername,
}: {
  initialDisplayName: string;
  initialUsername: string;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [username, setUsername] = useState(initialUsername);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty = displayName !== initialDisplayName || username !== initialUsername;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, username }),
      });
      const data = await res.json();
      setSubmitting(false);
      if (!data.ok) {
        setError(data.error ?? "Couldn't save that.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setSubmitting(false);
      setError("Couldn't reach the server. Check your connection and try again.");
    }
  }

  return (
    <div className="app-shell">
      <div style={{ flex: "none", padding: "8px 18px 12px", borderBottom: "1px solid var(--color-divider)", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => router.back()} className="btn btn-ghost" style={{ paddingLeft: 0, fontSize: 14, display: "inline-flex" }}>
          ←
        </button>
        <h4 style={{ margin: 0, fontSize: 18, color: "var(--color-text)" }}>Your account</h4>
      </div>
      <form onSubmit={onSubmit} style={{ flex: 1, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="field">
          <label htmlFor="displayName">Name</label>
          <input
            id="displayName"
            className="input"
            type="text"
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
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
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={20}
          />
        </div>
        {error && <div style={{ fontSize: 13, color: "var(--color-accent-300)", lineHeight: 1.5 }}>{error}</div>}
        {saved && !error && <div style={{ fontSize: 13, color: "var(--color-accent-400)" }}>Saved.</div>}
        <button
          className="btn btn-primary"
          style={{ minHeight: 44, fontSize: 15 }}
          type="submit"
          disabled={!dirty || submitting || !displayName.trim() || !username.trim()}
        >
          {submitting ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}
