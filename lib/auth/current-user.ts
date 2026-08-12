import "server-only";
import { cookies } from "next/headers";
import { query } from "../db2";
import { verifySessionToken } from "./session-v2";

export const SESSION_COOKIE = "wp_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 730; // ~2 years, no expiry in practice

export type CurrentUser = {
  id: string;
  email: string | null;
  displayName: string;
  username: string | null;
  phone: string | null;
  onboarded: boolean;
};

/** Resolves the signed-in user (if any) from the httpOnly session cookie. Works in Server
 * Components and Route Handlers alike -- both can call next/headers' cookies(). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const payload = verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!payload) return null;

  const rows = await query<{
    id: string;
    email: string | null;
    display_name: string;
    username: string | null;
    phone: string | null;
    onboarded_at: string | null;
    token_version: number;
  }>("SELECT id, email, display_name, username, phone, onboarded_at, token_version FROM users WHERE id = $1", [payload.u]);
  const user = rows[0];
  if (!user || user.token_version !== payload.v) return null;

  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    username: user.username,
    phone: user.phone,
    onboarded: user.onboarded_at !== null,
  };
}
