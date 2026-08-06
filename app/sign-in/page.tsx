"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/store";

const LEAGUE_NAME = "2026 NFL Wins Pool";

export default function SignInPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await signIn(phone);
    setSubmitting(false);
    if (result.ok) {
      router.push("/lobby");
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="app-shell" style={{ justifyContent: "center", padding: "0 28px 80px", gap: 28 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ width: 40, height: 3, background: "var(--color-accent)", borderRadius: 2 }} />
        <h2 style={{ fontSize: 30, margin: 0, color: "var(--color-text)" }}>{LEAGUE_NAME}</h2>
      </div>
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="field">
          <label htmlFor="phone">Phone number</label>
          <div style={{ display: "flex", gap: 8 }}>
            <div
              className="input"
              style={{ width: 60, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}
            >
              +1
            </div>
            <input
              id="phone"
              className="input"
              style={{ flex: 1 }}
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="(415) 555-0148"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        {error && (
          <div style={{ fontSize: 13, color: "var(--color-accent-300)", lineHeight: 1.5 }}>{error}</div>
        )}
        <button className="btn btn-primary btn-block" type="submit" disabled={!phone.trim() || submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
