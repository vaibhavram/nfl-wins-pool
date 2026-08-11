"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PodiumIcon, CalendarIcon, FootballIcon, DraftResultsIcon } from "./TabIcons";

const TABS = [
  { href: "/leaderboard", label: "Leaderboard", Icon: PodiumIcon },
  { href: "/schedule", label: "Schedule", Icon: CalendarIcon },
  { href: "/my-teams", label: "My teams", Icon: FootballIcon },
  { href: "/draft-results", label: "Draft", Icon: DraftResultsIcon },
];

export function TabBar() {
  const pathname = usePathname();
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
