import { NextResponse } from "next/server";
import { getEventLog } from "@/lib/draft-server";

/** Read-only, append-only audit trail — survives a draft_picks reset. Not linked from the UI;
 * exists so history can be inspected/recovered manually if a reset ever happens by accident. */
export async function GET() {
  const events = await getEventLog();
  return NextResponse.json({ events });
}
