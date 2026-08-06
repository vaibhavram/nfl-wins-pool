import { NextRequest, NextResponse } from "next/server";
import { managerFromAuthHeader } from "@/lib/session";
import { isCommissioner } from "@/lib/managers";
import { startDraft } from "@/lib/draft-server";

export async function POST(req: NextRequest) {
  const manager = managerFromAuthHeader(req.headers.get("authorization"));
  if (!manager) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }
  if (!isCommissioner(manager)) {
    return NextResponse.json({ ok: false, error: "Only the commissioner can start the draft." }, { status: 403 });
  }
  await startDraft();
  return NextResponse.json({ ok: true });
}
