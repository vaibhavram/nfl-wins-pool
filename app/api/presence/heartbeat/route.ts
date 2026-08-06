import { NextRequest, NextResponse } from "next/server";
import { managerFromAuthHeader } from "@/lib/session";
import { heartbeat } from "@/lib/presence-server";

export async function POST(req: NextRequest) {
  const manager = managerFromAuthHeader(req.headers.get("authorization"));
  if (!manager) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }
  await heartbeat(manager);
  return NextResponse.json({ ok: true });
}
