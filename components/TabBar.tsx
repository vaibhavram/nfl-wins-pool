"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/schedule", label: "Schedule" },
  { href: "/my-teams", label: "My teams" },
];

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="tab-bar">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link key={tab.href} href={tab.href} className="tab-item" data-active={active}>
            <span className="tab-dot" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
