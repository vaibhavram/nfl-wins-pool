"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Status = "consuming" | "success" | "error";

export function LinkConsumeContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("t");
  const [status, setStatus] = useState<Status>(() => (token ? "consuming" : "error"));
  const [error, setError] = useState<string | null>(() => (token ? null : "Missing or invalid link."));
  const [redirectTo, setRedirectTo] = useState("/pools");

  useEffect(() => {
    if (!token) return; // already reflected in the initial state above
    fetch("/api/auth/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          if (data.needsOnboarding) {
            // Skip the "you're signed in" screen for brand-new users -- go straight to the one
            // more step they actually need, carrying the original destination along with it.
            router.push(`/onboarding?redirectTo=${encodeURIComponent(data.redirectTo ?? "/pools")}`);
            return;
          }
          setRedirectTo(data.redirectTo ?? "/pools");
          setStatus("success");
        } else {
          setStatus("error");
          setError(data.error ?? "This link is invalid or has expired.");
        }
      })
      .catch(() => {
        setStatus("error");
        setError("Couldn't reach the server. Check your connection and try again.");
      });
  }, [token, router]);

  if (status === "consuming") {
    return (
      <div className="app-shell" style={{ justifyContent: "center", alignItems: "center", padding: 28 }}>
        <div style={{ fontSize: 14, color: "var(--color-neutral-500)" }}>Signing you in…</div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="app-shell" style={{ justifyContent: "center", padding: "0 28px 110px", gap: 20 }}>
        <h3 style={{ margin: 0, fontSize: 23, color: "var(--color-text)" }}>That link didn&apos;t work</h3>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--color-neutral-400)" }}>{error}</p>
        <Link href="/sign-in" className="btn btn-primary btn-block" style={{ minHeight: 46, fontSize: 15 }}>
          Try again
        </Link>
      </div>
    );
  }

  return (
    <div className="app-shell" style={{ justifyContent: "center", padding: "0 28px 110px", gap: 22 }}>
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: "1px solid var(--color-accent)",
          background: "var(--color-accent-900)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          color: "var(--color-accent-200)",
        }}
      >
        ✓
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h3 style={{ margin: 0, fontSize: 25, color: "var(--color-text)" }}>You&apos;re signed in</h3>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: "var(--color-neutral-400)" }}>This device stays signed in.</p>
      </div>
      <button className="btn btn-primary btn-block" style={{ minHeight: 46, fontSize: 15 }} onClick={() => router.push(redirectTo)}>
        Go to your pools
      </button>
    </div>
  );
}
