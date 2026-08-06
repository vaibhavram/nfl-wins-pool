import { NextResponse } from "next/server";
import { getPicks, isDraftStarted } from "@/lib/draft-server";

export async function GET() {
  const [picks, started] = await Promise.all([getPicks(), isDraftStarted()]);
  return NextResponse.json({ picks, started });
}
