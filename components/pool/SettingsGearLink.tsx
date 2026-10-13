"use client";

import Link from "next/link";
import { GearIcon } from "@/components/TabIcons";

/** The gear icon shown on every pool screen: commissioners land on the pool's settings (pick
 * clock, invites, members, pause/resume); everyone else lands on their own personal account
 * settings (name/username) -- there's nothing pool-level for a regular manager to configure.
 *
 * Drawn as a stroked SVG rather than the ⚙ glyph it used to be: the glyph rendered in whatever
 * weight and color the platform's emoji font chose, which read as a different family from the
 * camera button beside it. Both now come from TabIcons and inherit .btn-ghost's accent color. */
export function SettingsGearLink({ slug, isCommissioner }: { slug: string; isCommissioner: boolean }) {
  const href = isCommissioner ? `/p/${slug}/settings` : "/account";
  return (
    <Link
      href={href}
      className="btn btn-ghost btn-icon"
      style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
      aria-label="Settings"
    >
      <GearIcon />
    </Link>
  );
}
