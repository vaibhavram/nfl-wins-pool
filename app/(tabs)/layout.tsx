"use client";

import { RequireAuth } from "@/components/RequireAuth";
import { TabBar } from "@/components/TabBar";

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth requireDraftComplete={true}>
      <div className="app-shell">
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>{children}</div>
        <TabBar />
      </div>
    </RequireAuth>
  );
}
