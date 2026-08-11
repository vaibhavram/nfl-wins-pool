import { getCurrentUser } from "@/lib/auth/current-user";
import { SignOutButton } from "@/components/SignOutButton";

export default async function PoolsPage() {
  const user = await getCurrentUser();

  return (
    <>
      <div style={{ flex: "none", padding: "20px 20px 4px", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <h4 style={{ margin: 0, fontSize: 19, color: "var(--color-text)" }}>Your pools</h4>
          <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>{user?.email}</div>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 28, textAlign: "center" }}>
        <div style={{ fontSize: 14, color: "var(--color-neutral-500)", maxWidth: "28ch" }}>
          No pools yet. Creating and joining pools is coming next.
        </div>
      </div>
      <div style={{ flex: "none", padding: "12px 20px 30px", borderTop: "1px solid var(--color-divider)", display: "flex", justifyContent: "center" }}>
        <SignOutButton />
      </div>
    </>
  );
}
