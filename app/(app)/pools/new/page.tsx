"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const PICK_CLOCK_OPTIONS: { label: string; seconds: number }[] = [
  { label: "1 min", seconds: 60 },
  { label: "2 min", seconds: 120 },
  { label: "5 min", seconds: 300 },
  { label: "10 min", seconds: 600 },
  { label: "1 hour", seconds: 3600 },
  { label: "4 hours", seconds: 14400 },
  { label: "8 hours", seconds: 28800 },
  { label: "12 hours", seconds: 43200 },
  { label: "24 hours", seconds: 86400 },
];

export default function CreatePoolPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pickClockSeconds, setPickClockSeconds] = useState(43200);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/pools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, pickClockSeconds }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Something went wrong.");
        setSubmitting(false);
        return;
      }
      router.push(`/p/${data.slug}/invite`);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "6px 20px 0" }}>
        <Link href="/pools" className="btn btn-ghost" style={{ paddingLeft: 0, fontSize: 14, display: "inline-flex" }}>
          ← Your pools
        </Link>
      </div>
      <form onSubmit={onSubmit} style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ flex: 1, overflow: "auto", padding: "8px 20px 20px", display: "flex", flexDirection: "column", gap: 20 }} className="scr">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h4 style={{ margin: 0, fontSize: 22, color: "var(--color-text)" }}>Create a pool</h4>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "var(--color-neutral-500)" }}>
              Two fields and you&apos;re done. You&apos;ll be the commissioner.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="field">
              <label htmlFor="name">Pool name</label>
              <input
                id="name"
                className="input"
                type="text"
                placeholder="Sunday Regulars"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                maxLength={60}
              />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 13px",
                borderRadius: "var(--radius-md)",
                background: "var(--color-surface)",
                border: "1px solid var(--color-divider)",
              }}
            >
              <div style={{ fontSize: 13.5, color: "var(--color-neutral-400)" }}>Season</div>
              <div style={{ fontFamily: "var(--font-heading)", fontSize: 15, color: "var(--color-text)" }}>
                {new Date().getFullYear()}
              </div>
            </div>

            <div className="field">
              <label>Pick clock</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {PICK_CLOCK_OPTIONS.map((opt) => {
                  const active = opt.seconds === pickClockSeconds;
                  return (
                    <button
                      key={opt.seconds}
                      type="button"
                      onClick={() => setPickClockSeconds(opt.seconds)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "var(--radius-sm)",
                        fontSize: 13,
                        cursor: "pointer",
                        color: active ? "var(--color-accent-200)" : "var(--color-neutral-400)",
                        background: active ? "var(--color-accent-900)" : "var(--color-surface)",
                        border: `1px solid ${active ? "var(--color-accent)" : "var(--color-divider)"}`,
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--color-neutral-600)", paddingTop: 6 }}>
                How long each manager has on the clock. Short clocks make it a draft night; long ones let people pick
                whenever they&apos;re free.
              </div>
            </div>
          </div>

          <div
            style={{
              padding: 16,
              borderRadius: "var(--radius-md)",
              background: "var(--color-surface)",
              border: "1px solid var(--color-divider)",
              display: "flex",
              flexDirection: "column",
              gap: 11,
            }}
          >
            <div style={{ fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>
              How every pool runs
            </div>
            {[
              "10 managers, 3 picks each — 30 teams go, 2 don't.",
              "Draft order follows the Grantland method: the order shifts round to round so an early first pick costs you later.",
              "Total regular-season wins decides it. Ties count half.",
            ].map((line) => (
              <div key={line} style={{ display: "flex", gap: 9, fontSize: 13.5, lineHeight: 1.45, color: "var(--color-neutral-300)" }}>
                <span style={{ color: "var(--color-accent-400)" }}>·</span>
                <span>{line}</span>
              </div>
            ))}
            <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--color-neutral-600)", paddingTop: 2 }}>
              Nothing here is configurable in this version.
            </div>
          </div>

          {error && <div style={{ fontSize: 13, color: "var(--color-accent-300)", lineHeight: 1.5 }}>{error}</div>}
        </div>

        <div style={{ flex: "none", padding: "12px 20px 30px", borderTop: "1px solid var(--color-divider)" }}>
          <button className="btn btn-primary btn-block" style={{ minHeight: 48, fontSize: 15, marginTop: 0 }} type="submit" disabled={!name.trim() || submitting}>
            {submitting ? "Creating…" : "Create pool"}
          </button>
        </div>
      </form>
    </div>
  );
}
