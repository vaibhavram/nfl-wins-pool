"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { poolHref, statusLabel } from "@/lib/pool-status";
import type { PoolCard } from "@/lib/dashboard-server";

/** Tapping the pool name opens a sheet listing the user's other pools -- the only way back to
 * "my other pools" from anywhere inside a pool today, so this gets dropped into the header of
 * every pool-scoped screen. Fetches lazily (only once the sheet is actually opened) since the
 * summary endpoint computes live standings/ranks and isn't cheap enough to run on every page
 * load for screens nobody opens the switcher from. */
export function PoolSwitcher({ slug, poolName }: { slug: string; poolName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pools, setPools] = useState<PoolCard[] | null>(null);
  const [archived, setArchived] = useState<PoolCard[]>([]);

  useEffect(() => {
    if (!open || pools !== null) return;
    // Marking the new request as loading is the effect's job -- it's synchronizing with the
    // external fetch it's about to start, not deriving state from a render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch("/api/pools/summary")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setPools(data.pools);
          setArchived(data.archived ?? []);
        }
      })
      .finally(() => setLoading(false));
  }, [open, pools]);

  function goTo(p: PoolCard) {
    setOpen(false);
    if (p.slug !== slug) router.push(poolHref(p.slug, p.status));
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          maxWidth: "100%",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: 13.5,
            color: "var(--color-text)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {poolName}
        </span>
        <span style={{ fontSize: 10, color: "var(--color-neutral-500)", flex: "none" }}>⌄</span>
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.55)",
            zIndex: 50,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 480,
              maxHeight: "78vh",
              overflow: "auto",
              background: "var(--color-surface)",
              borderRadius: "16px 16px 0 0",
              display: "flex",
              flexDirection: "column",
            }}
            className="scr"
          >
            <div
              style={{
                flex: "none",
                padding: "16px 20px 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid var(--color-divider)",
              }}
            >
              <h4 style={{ margin: 0, fontSize: 16, color: "var(--color-text)" }}>Your pools</h4>
              <button onClick={() => setOpen(false)} className="btn btn-ghost btn-icon" style={{ fontSize: 14 }}>
                ✕
              </button>
            </div>

            <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
              {loading && !pools && (
                <div style={{ fontSize: 13, color: "var(--color-neutral-500)", textAlign: "center", padding: 20 }}>Loading…</div>
              )}
              {pools?.map((p) => {
                const { label, color } = statusLabel(p);
                const isCurrent = p.slug === slug;
                return (
                  <div
                    key={p.id}
                    onClick={() => goTo(p)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      padding: "11px 12px",
                      borderRadius: "var(--radius-md)",
                      cursor: isCurrent ? "default" : "pointer",
                      background: isCurrent ? "var(--color-accent-900)" : "var(--color-bg)",
                      border: `1px solid ${isCurrent ? "var(--color-accent-700)" : "var(--color-divider)"}`,
                    }}
                  >
                    <div style={{ fontSize: 14.5, color: "var(--color-text)", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.name}
                      {isCurrent && <span style={{ color: "var(--color-accent-300)" }}> · here</span>}
                    </div>
                    <div style={{ fontSize: 12, color, flex: "none" }}>{label}</div>
                  </div>
                );
              })}
            </div>

            {archived.length > 0 && (
              <details style={{ padding: "0 20px 12px" }}>
                <summary style={{ fontSize: 12, color: "var(--color-neutral-500)", cursor: "pointer" }}>
                  Archived seasons ({archived.length})
                </summary>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  {archived.map((p) => {
                    const { label } = statusLabel(p);
                    return (
                      <div
                        key={`${p.id}-${p.seasonYear}`}
                        onClick={() => goTo(p)}
                        style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--color-neutral-400)", cursor: "pointer", padding: "4px 0" }}
                      >
                        <span>
                          {p.name} · {p.seasonYear}
                        </span>
                        <span>{label}</span>
                      </div>
                    );
                  })}
                </div>
              </details>
            )}

            <Link
              href="/pools"
              onClick={() => setOpen(false)}
              style={{
                flex: "none",
                display: "block",
                textAlign: "center",
                padding: "14px 20px",
                borderTop: "1px solid var(--color-divider)",
                fontSize: 13.5,
                color: "var(--color-accent-300)",
              }}
            >
              See all pools
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
