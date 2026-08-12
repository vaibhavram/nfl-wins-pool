// Shared between the create-pool form, its API route, and the commissioner's draft-settings
// panel -- one source of truth for which pick-clock durations are offered/accepted.
export const PICK_CLOCK_OPTIONS: { label: string; seconds: number }[] = [
  { label: "1 min", seconds: 60 },
  { label: "2 min", seconds: 120 },
  { label: "5 min", seconds: 300 },
  { label: "10 min", seconds: 600 },
  { label: "1 hour", seconds: 3600 },
  { label: "4 hours", seconds: 14400 },
  { label: "8 hours", seconds: 28800 },
  { label: "12 hours", seconds: 43200 },
  { label: "24 hours", seconds: 86400 },
];

export const PICK_CLOCK_OPTIONS_SECONDS = new Set(PICK_CLOCK_OPTIONS.map((o) => o.seconds));
