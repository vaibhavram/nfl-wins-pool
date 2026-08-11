"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Something went wrong.");
        setSubmitting(false);
        return;
      }
      router.push(`/check-email?email=${encodeURIComponent(email)}`);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="app-shell" style={{ justifyContent: "center", padding: "0 28px 80px", gap: 28 }}>
      <div style={{ padding: "6px 0 0" }}>
        <Link href="/" className="btn btn-ghost" style={{ paddingLeft: 0, fontSize: 14, display: "inline-flex" }}>
          ← Back
        </Link>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ width: 40, height: 3, background: "var(--color-accent)", borderRadius: 2 }} />
        <h2 style={{ fontSize: 28, margin: 0, color: "var(--color-text)" }}>Sign in</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--color-neutral-400)" }}>
          We&apos;ll email you a link that signs you in.
        </p>
      </div>
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
          {submitting ? "Sending…" : "Email me a link"}
        </button>
      </form>
    </div>
  );
}
