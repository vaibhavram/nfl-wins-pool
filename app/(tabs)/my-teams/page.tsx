"use client";

import { ManagerRoster } from "@/components/ManagerRoster";
import { useAuth } from "@/lib/store";

export default function MyTeamsPage() {
  const { manager } = useAuth();
  if (!manager) return null;
  return <ManagerRoster name={manager.name} title="My teams" />;
}
