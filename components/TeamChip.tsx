"use client";

import { useState } from "react";
import { TEAM } from "@/lib/teams";

export function TeamChip({
  ab,
  size = 32,
  fontSize,
}: {
  ab: string;
  size?: number;
  fontSize?: number;
}) {
  const team = TEAM[ab];
  // Keyed to `ab` (not a plain boolean) so a stale error from a previously-shown team
  // doesn't stick around when the same TeamChip instance is reused for a different team.
  const [erroredAb, setErroredAb] = useState<string | null>(null);
  const showLogo = Boolean(team) && erroredAb !== ab;

  return (
    <div
      className="team-chip"
      style={{
        width: size,
        height: size,
        background: team?.color ?? "#3f424d",
      }}
      title={team?.full ?? ab}
    >
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny hotlinked crest, not worth Next/Image's optimizer proxy
        <img
          src={team.logo}
          alt=""
          onError={() => setErroredAb(ab)}
          style={{ width: "76%", height: "76%", objectFit: "contain" }}
        />
      ) : (
        <span style={{ fontSize: fontSize ?? Math.max(8, size * 0.3) }}>{ab}</span>
      )}
    </div>
  );
}
