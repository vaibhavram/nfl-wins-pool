import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getUserPools, getUserArchivedSeasons } from "@/lib/dashboard-server";

/** Backs the pool switcher sheet -- lazily fetched client-side only when the sheet is opened, so
 * the (fairly expensive: live standings + per-pool rank/on-clock lookups) computation doesn't
 * run on every single pool-screen page load, only when someone actually wants to switch pools. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  const [pools, archived] = await Promise.all([getUserPools(user.id), getUserArchivedSeasons(user.id)]);
  return NextResponse.json({ ok: true, pools, archived });
}
