export function InvitePreviewCard({
  poolName,
  seasonYear,
  commissionerName,
  memberCount,
}: {
  poolName: string;
  seasonYear: number;
  commissionerName: string;
  memberCount: number;
}) {
  return (
    <div style={{ padding: 18, borderRadius: "var(--radius-md)", background: "var(--color-surface)", border: "1px solid var(--color-divider)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-accent-300)" }}>You&apos;re invited</div>
        <h3 style={{ margin: 0, fontSize: 24, color: "var(--color-text)" }}>{poolName}</h3>
        <div style={{ fontSize: 13, color: "var(--color-neutral-500)" }}>
          {seasonYear} season · {commissionerName} is the commissioner
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--color-neutral-500)", paddingTop: 10 }}>{memberCount} of 10 seats taken</div>
    </div>
  );
}
