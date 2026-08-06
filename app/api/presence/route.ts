import { NextResponse } from "next/server";
import { onlineManagers } from "@/lib/presence-server";

export async function GET() {
  const online = await onlineManagers();
  return NextResponse.json({ online });
}
