"use client";

import { useCallback, useRef, useState } from "react";
import { CameraIcon } from "@/components/TabIcons";

type Status = "idle" | "working" | "error";

function fileName(poolName: string): string {
  const base = poolName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${base || "pool"}-standings.png`;
}

/** Saves the current leaderboard to the phone's photo library.
 *
 * The PNG itself is rendered server-side (/api/p/[slug]/leaderboard-image) with the same code
 * that draws the weekly digest email's leaderboard, so what gets saved matches what gets emailed.
 *
 * Getting it into Photos is the browser's call, not ours: on iOS and Android the share sheet is
 * the only path from a web page to the camera roll, so a successful `canShare({ files })` test
 * means tapping through to "Save Image" works. Everywhere else (desktop, Android browsers that
 * reject file payloads) this degrades to an ordinary download.
 *
 * Why the fetch starts on pointer-down rather than on click: Safari ties navigator.share to the
 * tap that triggered it, and an `await` of any length in between can lose that activation and
 * throw NotAllowedError. Warming the request on pointer-down means the blob is usually already in
 * hand by the time the click lands, so share() is reached promptly; if it's rejected anyway, the
 * download path still runs. */
export function SaveLeaderboardButton({ slug, poolName }: { slug: string; poolName: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const pending = useRef<Promise<Blob> | null>(null);

  const warm = useCallback(() => {
    if (pending.current) return;
    pending.current = fetch(`/api/p/${slug}/leaderboard-image`, { cache: "no-store" }).then((res) => {
      if (!res.ok) throw new Error(`Leaderboard image failed (${res.status})`);
      return res.blob();
    });
    // A warm-up that fails shouldn't surface as an unhandled rejection before the tap it belongs
    // to; the click handler awaits this same promise and reports the error there.
    pending.current.catch(() => {});
  }, [slug]);

  const download = useCallback((blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  const save = useCallback(async () => {
    setStatus("working");
    warm();
    const name = fileName(poolName);
    try {
      const blob = await (pending.current as Promise<Blob>);
      const file = new File([blob], name, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `${poolName} standings` });
        } catch (err) {
          // Dismissing the share sheet is a choice, not a failure.
          if ((err as Error)?.name === "AbortError") return setStatus("idle");
          download(blob, name);
        }
      } else {
        download(blob, name);
      }
      setStatus("idle");
    } catch {
      setStatus("error");
    } finally {
      // Always re-fetch next time: standings and win probabilities move.
      pending.current = null;
    }
  }, [download, poolName, warm]);

  return (
    <>
      {status === "error" && <div style={{ fontSize: 11.5, color: "var(--color-neutral-500)" }}>Couldn&apos;t save</div>}
      <button
        type="button"
        onPointerDown={warm}
        onClick={save}
        disabled={status === "working"}
        aria-busy={status === "working"}
        aria-label="Save leaderboard image"
        title="Save leaderboard image"
        className="btn btn-ghost btn-icon"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", opacity: status === "working" ? 0.5 : 1 }}
      >
        <CameraIcon />
      </button>
    </>
  );
}
