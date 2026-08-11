"use client";

import { useParams, useRouter } from "next/navigation";
import { RequireAuth } from "@/components/RequireAuth";
import { ManagerRoster } from "@/components/ManagerRoster";
import { TabBar } from "@/components/TabBar";
import { useAuth } from "@/lib/store";
import { MANAGER_NAMES } from "@/lib/managers";

function ManagerTeamsContent() {
  const router = useRouter();
  const params = useParams<{ name: string }>();
  const { manager } = useAuth();

  const name = decodeURIComponent(params.name);
  const isValidManager = MANAGER_NAMES.includes(name);
  const mine = name === manager?.name;

  if (!isValidManager) {
    return (
      <div className="app-shell" style={{ padding: 28 }}>
        <p>Unknown manager &ldquo;{params.name}&rdquo;.</p>
        <button className="btn btn-ghost" onClick={() => router.back()}>
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div style={{ padding: "16px 16px 0" }}>
        <button className="btn btn-ghost" style={{ paddingLeft: 0, fontSize: 14 }} onClick={() => router.back()}>
          ← Back
        </button>
      </div>
      <ManagerRoster name={name} title={mine ? `${name} (you)` : name} />
      <TabBar />
    </div>
  );
}

export default function ManagerTeamsPage() {
  return (
    <RequireAuth>
      <ManagerTeamsContent />
    </RequireAuth>
  );
}
