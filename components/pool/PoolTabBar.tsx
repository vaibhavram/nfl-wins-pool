"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PodiumIcon, CalendarIcon, FootballIcon, DraftResultsIcon } from "@/components/TabIcons";

export function PoolTabBar({ slug }: { slug: string }) {
  const pathname = usePathname();
  const TABS = [
    { href: `/p/${slug}/leaderboard`, label: "Leaderboard", Icon: PodiumIcon },
    { href: `/p/${slug}/schedule`, label: "Schedule", Icon: CalendarIcon },
    { href: `/p/${slug}/my-teams`, label: "My teams", Icon: FootballIcon },
    { href: `/p/${slug}/draft-results`, label: "Draft", Icon: DraftResultsIcon },
  ];
  return (
    <nav className="tab-bar">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link key={tab.href} href={tab.href} className="tab-item" data-active={active}>
            <tab.Icon />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
