"use client";

import Link from "next/link";

/** The gear icon shown on every pool screen: commissioners land on the pool's settings (pick
 * clock, invites, members, pause/resume); everyone else lands on their own personal account
 * settings (name/username) -- there's nothing pool-level for a regular manager to configure. */
export function SettingsGearLink({ slug, isCommissioner }: { slug: string; isCommissioner: boolean }) {
  const href = isCommissioner ? `/p/${slug}/settings` : "/account";
  return (
    <Link href={href} className="btn btn-ghost btn-icon" style={{ fontSize: 15 }} aria-label="Settings">
      ⚙
    </Link>
  );
}
