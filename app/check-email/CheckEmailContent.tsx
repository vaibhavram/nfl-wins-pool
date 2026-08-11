"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export function CheckEmailContent() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const [submitting, setSubmitting] = useState(false);
  const [resent, setResent] = useState(false);

  async function resend() {
    if (!email) return;
    setSubmitting(true);
    await fetch("/api/auth/request-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => {});
    setSubmitting(false);
    setResent(true);
  }

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
          We sent a sign-in link to <span style={{ color: "var(--color-text)" }}>{email}</span>. It works for 20 minutes
          and only once.
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}>
        <button className="btn btn-secondary btn-block" style={{ minHeight: 44, fontSize: 14 }} onClick={resend} disabled={submitting || !email}>
          {resent ? "Link resent" : submitting ? "Sending…" : "Resend link"}
        </button>
        <div style={{ textAlign: "center", fontSize: 12.5, color: "var(--color-neutral-600)" }}>
          Wrong address?{" "}
          <Link href="/sign-in" style={{ color: "var(--color-accent-300)" }}>
            Start over
          </Link>
        </div>
      </div>
    </div>
  );
}
