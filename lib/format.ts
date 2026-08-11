/** Formats an ISO kickoff timestamp in the viewer's own local timezone (not ESPN's Eastern-time strings). */
export function formatKickoff(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${date} - ${time}`;
}
