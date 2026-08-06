import "server-only";
import { MANAGER_NAMES } from "./managers";

// Phone roster lives only in the MANAGER_PHONES env var (never in source/git), as a JSON array:
// [{"name":"...","phone":"5155550100"}, ...]. Set it in the Railway dashboard, not a .env file
// that could get committed.
function loadRoster(): Record<string, string> {
  const raw = process.env.MANAGER_PHONES;
  if (!raw) throw new Error("MANAGER_PHONES env var is not set");
  const parsed = JSON.parse(raw) as { name: string; phone: string }[];
  const roster: Record<string, string> = {};
  for (const { name, phone } of parsed) {
    if (!MANAGER_NAMES.includes(name)) continue; // ignore anything not in the public roster
    roster[phone.replace(/\D/g, "").slice(-10)] = name;
  }
  return roster;
}

let cachedRoster: Record<string, string> | null = null;

export function findManagerNameByPhone(input: string): string | null {
  if (!cachedRoster) cachedRoster = loadRoster();
  const digits = input.replace(/\D/g, "").slice(-10);
  return cachedRoster[digits] ?? null;
}
