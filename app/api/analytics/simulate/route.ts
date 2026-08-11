import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { runSimulation } from "@/lib/simulation";
import { getPicks } from "@/lib/draft-server";

// The draft's over and picks are final, and nfelo's own ratings only move a few times a week —
// cache the (CPU-heavy, ~2s for 20k trials) simulation result rather than re-running it on every
// page load. Route-level `revalidate` doesn't reliably apply here since the handler reads
// searchParams, so this caches the actual work directly instead.
const getCachedSimulation = unstable_cache(
  async (trials?: number) => {
    const picks = await getPicks();
    return runSimulation(picks, trials);
  },
  ["pool-simulation"],
  { revalidate: 21600 }, // 6h, matching lib/nfelo.ts's own cache window
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const trialsParam = searchParams.get("trials");
  const trials = trialsParam ? Number(trialsParam) : undefined;

  const start = Date.now();
  const summary = await getCachedSimulation(trials);
  return NextResponse.json({ ...summary, computeMs: Date.now() - start });
}
