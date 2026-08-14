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

// A fast dev/testing-only option -- not something a real pool would ever want, so it's hidden
// unless you're signed in as this specific username, both in the UI and in the API validation.
const DEV_USERNAME = "vaibhav";
const DEV_PICK_CLOCK_OPTION = { label: "10 sec", seconds: 10 };

export function pickClockOptionsFor(username: string | null | undefined): { label: string; seconds: number }[] {
  return username === DEV_USERNAME ? [DEV_PICK_CLOCK_OPTION, ...PICK_CLOCK_OPTIONS] : PICK_CLOCK_OPTIONS;
}

export function isValidPickClockSeconds(seconds: unknown, username: string | null | undefined): boolean {
  if (typeof seconds !== "number") return false;
  if (PICK_CLOCK_OPTIONS_SECONDS.has(seconds)) return true;
  return username === DEV_USERNAME && seconds === DEV_PICK_CLOCK_OPTION.seconds;
}
