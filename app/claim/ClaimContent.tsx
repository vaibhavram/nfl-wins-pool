"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { TeamLogo } from "@/components/TeamLogo";
import { TEAM } from "@/lib/teams";
import { ordinal } from "@/lib/format";

type TeamPreview = { ab: string; wins: number; losses: number; ties: number };
type Preview = { name: string; poolName: string; draftPosition: number; memberCount: number; teams: TeamPreview[] };

type Step = "phone" | "confirm" | "sent";

export function ClaimContent() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onLookup(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/claim/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Something went wrong.");
        setSubmitting(false);
        return;
      }
      setPreview(data);
      setStep("confirm");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onConfirm(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/claim/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, email }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Something went wrong.");
        setSubmitting(false);
        return;
      }
      setStep("sent");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  function tryAnotherNumber() {
    setPreview(null);
    setEmail("");
    setError(null);
    setStep("phone");
  }

  if (step === "sent") {
    return (
      <div className="app-shell" style={{ justifyContent: "center", padding: "0 28px 110px", gap: 24 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-accent-700)",
            background: "var(--color-accent-900)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            color: "var(--color-accent-200)",
          }}
        >
          ✉
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 25, color: "var(--color-text)" }}>Check your email</h3>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: "var(--color-neutral-400)" }}>
            We sent a link to <span style={{ color: "var(--color-text)" }}>{email}</span> to confirm it&apos;s you. It works
            for 20 minutes and only once.
          </p>
        </div>
        <div style={{ textAlign: "center", fontSize: 12.5, color: "var(--color-neutral-600)" }}>
          Wrong address?{" "}
          <button onClick={() => setStep("confirm")} className="btn btn-ghost" style={{ display: "inline", padding: 0, fontSize: 12.5 }}>
            Go back
          </button>
        </div>
      </div>
    );
  }

  if (step === "confirm" && preview) {
    return (
      <div className="app-shell" style={{ justifyContent: "center", padding: "0 28px 80px", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ width: 40, height: 3, background: "var(--color-accent)", borderRadius: 2 }} />
          <h2 style={{ fontSize: 26, margin: 0, color: "var(--color-text)" }}>Is this you?</h2>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-neutral-500)" }}>Matched to {phone}</p>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 3,
            padding: "14px 16px",
            borderRadius: "var(--radius-md)",
            background: "var(--color-surface)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div style={{ fontSize: 17, color: "var(--color-text)" }}>{preview.name}</div>
          <div style={{ fontSize: 13, color: "var(--color-neutral-500)" }}>
            {preview.poolName} · {ordinal(preview.draftPosition)} of {preview.memberCount}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>
            Your teams
          </div>
          {preview.teams.map((t) => {
            const team = TEAM[t.ab];
            return (
              <div
                key={t.ab}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: "var(--radius-md)",
                  background: "var(--color-surface)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <TeamLogo ab={t.ab} size={36} />
                <div style={{ flex: 1, fontSize: 14, color: "var(--color-text)" }}>{team?.full ?? t.ab}</div>
                <div style={{ fontFamily: "var(--font-heading)", fontSize: 17, color: "var(--color-text)" }}>
                  {t.wins}–{t.losses}
                  {t.ties ? `–${t.ties}` : ""}
                </div>
              </div>
            );
          })}
        </div>

        <form onSubmit={onConfirm} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="field">
            <label htmlFor="email">Email to use from now on</label>
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
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "var(--color-neutral-500)" }}>
            Your wins, your teams, and every pick you made carry over untouched. Only how you sign in changes.
          </p>
          {error && <div style={{ fontSize: 13, color: "var(--color-accent-300)", lineHeight: 1.5 }}>{error}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={!email.trim() || submitting}>
            {submitting ? "Sending…" : "Yes, that's me — send the link"}
          </button>
          <button type="button" onClick={tryAnotherNumber} className="btn btn-ghost btn-block" style={{ fontSize: 13 }}>
            Not you? Try another number
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-shell" style={{ justifyContent: "center", padding: "0 28px 80px", gap: 28 }}>
      <div style={{ padding: "6px 0 0" }}>
        <Link href="/sign-in" className="btn btn-ghost" style={{ paddingLeft: 0, fontSize: 14, display: "inline-flex" }}>
          ← Back
        </Link>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ width: 40, height: 3, background: "var(--color-accent)", borderRadius: 2 }} />
        <h2 style={{ fontSize: 28, margin: 0, color: "var(--color-text)" }}>Find your pool</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--color-neutral-400)" }}>
          Enter the phone number your commissioner has on file for you.
        </p>
      </div>
      <form onSubmit={onLookup} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="field">
          <label htmlFor="phone">Phone number</label>
          <input
            id="phone"
            className="input"
            type="tel"
            autoComplete="tel"
            placeholder="(415) 555-0148"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoFocus
          />
        </div>
        {error && <div style={{ fontSize: 13, color: "var(--color-accent-300)", lineHeight: 1.5 }}>{error}</div>}
        <button className="btn btn-primary btn-block" type="submit" disabled={!phone.trim() || submitting}>
          {submitting ? "Looking…" : "Look me up"}
        </button>
      </form>
    </div>
  );
}
