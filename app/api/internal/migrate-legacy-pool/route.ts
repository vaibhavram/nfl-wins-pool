import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { withTransaction, type ScopedQuery } from "@/lib/db2";
import { generateSlug } from "@/lib/pools-server";
import { hashPhone } from "@/lib/phone-hmac";

const TOTAL_PICKS = 30;
const TOTAL_MANAGERS = 10;

type Payload = {
  poolName: string;
  commissionerEmail: string;
  commissionerName: string; // the legacy manager name that maps to the commissioner (e.g. "Vaibhav")
  order: string[]; // 10 names, draft position order (index 0 = position 1)
  picks: { pickNo: number; manager: string; teamAb: string }[]; // 30
  roster: { name: string; phone: string }[]; // 10 -- hashed immediately, never stored raw
};

function isValidPayload(body: unknown): body is Payload {
  const b = body as Partial<Payload> | null;
  if (!b || typeof b.poolName !== "string" || typeof b.commissionerEmail !== "string" || typeof b.commissionerName !== "string") {
    return false;
  }
  if (!Array.isArray(b.order) || b.order.length !== TOTAL_MANAGERS || !b.order.every((n) => typeof n === "string")) return false;
  if (!Array.isArray(b.picks) || b.picks.length !== TOTAL_PICKS) return false;
  if (!Array.isArray(b.roster) || b.roster.length !== TOTAL_MANAGERS) return false;
  return true;
}

// One-time internal endpoint: writes a fully-assembled snapshot of the legacy pool (draft
// order, picks, phone roster) into the v2 schema in a single transaction. Deliberately has no
// knowledge of the legacy service or its database -- the caller assembles the payload (via the
// legacy app's own public /api/draft/state plus a one-off read of its MANAGER_PHONES env var)
// so this route never needs cross-service access and never logs anything from the request body
// (the phone roster is hashed and discarded within this handler, never persisted raw).
export async function POST(req: Request) {
  const secret = process.env.MIGRATE_SECRET;
  if (!secret) return NextResponse.json({ error: "MIGRATE_SECRET not configured" }, { status: 500 });

  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  const authorized = a.length === b.length && timingSafeEqual(a, b);
  if (!authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!isValidPayload(body)) {
    return NextResponse.json({ ok: false, error: "Malformed payload" }, { status: 400 });
  }
  const { poolName, commissionerEmail, commissionerName, order, picks, roster } = body;

  if (!order.includes(commissionerName)) {
    return NextResponse.json({ ok: false, error: `commissionerName "${commissionerName}" not present in order` }, { status: 400 });
  }
  const rosterNames = new Set(roster.map((r) => r.name));
  for (const name of order) {
    if (name !== commissionerName && !rosterNames.has(name)) {
      return NextResponse.json({ ok: false, error: `No roster phone entry for "${name}"` }, { status: 400 });
    }
  }

  try {
    const result = await withTransaction(async (query: ScopedQuery) => {
      const commissioners = await query<{ id: string }>("SELECT id FROM users WHERE email = $1", [commissionerEmail]);
      const commissionerId = commissioners[0]?.id;
      if (!commissionerId) throw new Error(`No existing user with email ${commissionerEmail}`);

      const existingLegacyPool = await query<{ id: string }>(
        "SELECT id FROM pools WHERE is_legacy = true AND created_by = $1",
        [commissionerId],
      );
      if (existingLegacyPool[0]) throw new Error("A legacy pool for this commissioner already exists -- refusing to run twice");

      // Map manager name -> user id, seeding a placeholder for everyone except the commissioner
      // (whose real account we already have).
      const userIdByName = new Map<string, string>();
      userIdByName.set(commissionerName, commissionerId);
      for (const { name, phone } of roster) {
        if (name === commissionerName) continue;
        const created = await query<{ id: string }>(
          "INSERT INTO users (display_name, legacy_manager_name, legacy_phone_hmac) VALUES ($1, $2, $3) RETURNING id",
          [name, name, hashPhone(phone)],
        );
        userIdByName.set(name, created[0].id);
      }

      const slug = generateSlug();
      const pools = await query<{ id: string }>(
        "INSERT INTO pools (slug, name, created_by, is_legacy) VALUES ($1, $2, $3, true) RETURNING id",
        [slug, poolName, commissionerId],
      );
      const poolId = pools[0].id;

      for (let i = 0; i < order.length; i++) {
        const name = order[i];
        const userId = userIdByName.get(name)!;
        const role = name === commissionerName ? "commissioner" : "manager";
        await query("INSERT INTO pool_members (pool_id, user_id, seat_no, role) VALUES ($1, $2, $3, $4)", [
          poolId,
          userId,
          i + 1,
          role,
        ]);
      }

      const seasons = await query<{ id: string }>(
        `INSERT INTO pool_seasons (pool_id, season_year, status, draft_started_at, draft_completed_at)
         VALUES ($1, $2, 'in_season', now(), now()) RETURNING id`,
        [poolId, new Date().getFullYear()],
      );
      const seasonId = seasons[0].id;

      for (let i = 0; i < order.length; i++) {
        const name = order[i];
        const userId = userIdByName.get(name)!;
        await query("INSERT INTO season_managers (season_id, user_id, display_name, draft_position) VALUES ($1, $2, $3, $4)", [
          seasonId,
          userId,
          name,
          i + 1,
        ]);
      }

      for (const pick of picks) {
        const userId = userIdByName.get(pick.manager);
        if (!userId) throw new Error(`Pick ${pick.pickNo} references unknown manager "${pick.manager}"`);
        await query("INSERT INTO season_picks (season_id, pick_no, user_id, team_ab, auto) VALUES ($1, $2, $3, $4, false)", [
          seasonId,
          pick.pickNo,
          userId,
          pick.teamAb,
        ]);
      }

      return { poolId, slug };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
