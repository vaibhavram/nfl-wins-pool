import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { query } from "@/lib/db2";

// Read-only twin of /api/internal/migrate: same MIGRATE_SECRET bearer gate. One-off diagnostic
// for "does this person already have an account" questions -- searches display_name, username,
// and email by substring (never returns phone or legacy_phone_hmac).
export async function GET(req: Request) {
  const secret = process.env.MIGRATE_SECRET;
  if (!secret) return NextResponse.json({ error: "MIGRATE_SECRET not configured" }, { status: 500 });

  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  const authorized = a.length === b.length && timingSafeEqual(a, b);
  if (!authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ ok: false, error: "Missing ?q=" }, { status: 400 });

  const rows = await query<{
    id: string;
    display_name: string;
    username: string | null;
    email: string | null;
    legacy_manager_name: string | null;
    claimed_at: string | null;
    onboarded_at: string | null;
    created_at: string;
  }>(
    `SELECT id, display_name, username, email, legacy_manager_name, claimed_at, onboarded_at, created_at
     FROM users
     WHERE display_name ILIKE $1 OR username ILIKE $1 OR email ILIKE $1 OR legacy_manager_name ILIKE $1
     ORDER BY created_at DESC`,
    [`%${q}%`],
  );

  return NextResponse.json({ ok: true, users: rows });
}
