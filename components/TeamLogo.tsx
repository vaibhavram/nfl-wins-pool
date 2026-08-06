"use client";

import { useState } from "react";
import { TEAM } from "@/lib/teams";

/** Bare team crest, no circular chip background — for contexts with room to breathe. */
export function TeamLogo({ ab, size = 56 }: { ab: string; size?: number }) {
  const team = TEAM[ab];
  const [erroredAb, setErroredAb] = useState<string | null>(null);
  const showLogo = Boolean(team) && erroredAb !== ab;

  if (!showLogo) {
    return (
      <div
        style={{
          width: size,
          height: size,
          flex: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.28,
          fontWeight: 700,
          color: team?.color ?? "var(--color-neutral-500)",
        }}
      >
        {ab}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny hotlinked crest, not worth Next/Image's optimizer proxy
    <img
      src={team.logo}
      alt={team.full}
      onError={() => setErroredAb(ab)}
      style={{ width: size, height: size, flex: "none", objectFit: "contain" }}
    />
  );
}
