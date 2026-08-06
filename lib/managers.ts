// Public, client-safe roster: names only, in draft position order (1-10) — see lib/draft.ts
// for the pick-order pattern that maps to these positions. No phone numbers here; those live
// server-side only (MANAGER_PHONES env var), looked up via /api/auth/lookup.
export const MANAGER_NAMES: string[] = [
  "Rahul",
  "Jong Ha",
  "Deepak",
  "Keyur",
  "Mohin",
  "Akash",
  "Kaanchana",
  "Vaibhav",
  "Leo",
  "Advait",
];
