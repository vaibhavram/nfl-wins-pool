import { NextRequest, NextResponse } from "next/server";
import { managerFromAuthHeader } from "@/lib/session";
import { submitPick } from "@/lib/draft-server";

export async function POST(req: NextRequest) {
  const manager = managerFromAuthHeader(req.headers.get("authorization"));
  if (!manager) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const teamAb = typeof body?.teamAb === "string" ? body.teamAb : null;
  if (!teamAb) {
    return NextResponse.json({ ok: false, error: "Missing teamAb." }, { status: 400 });
  }

  const result = await submitPick(manager, teamAb);
  if (!result.ok) {
    return NextResponse.json(result, { status: result.status });
  }
  return NextResponse.json(result);
}
