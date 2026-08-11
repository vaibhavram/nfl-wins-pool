"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function extractToken(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/join\/([^/?#\s]+)/);
  return match ? match[1] : trimmed;
}

export default function JoinLandingPage() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const token = extractToken(value);
    if (token) router.push(`/join/${token}`);
  }

  return (
    <div className="app-shell" style={{ justifyContent: "center", padding: "0 28px 80px", gap: 24 }}>
      <div style={{ padding: "6px 0 0" }}>
        <Link href="/pools" className="btn btn-ghost" style={{ paddingLeft: 0, fontSize: 14, display: "inline-flex" }}>
          ← Your pools
        </Link>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 style={{ fontSize: 26, margin: 0, color: "var(--color-text)" }}>Join a pool</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--color-neutral-400)" }}>
          Paste the invite link a friend sent you.
        </p>
      </div>
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="field">
          <label htmlFor="invite">Invite link</label>
          <input
            id="invite"
            className="input"
            type="text"
            placeholder="thewinspool.com/join/..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        </div>
        <button className="btn btn-primary btn-block" type="submit" disabled={!value.trim()}>
          Continue
        </button>
      </form>
    </div>
  );
}
