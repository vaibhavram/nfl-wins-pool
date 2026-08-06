import { NextResponse } from "next/server";
import { getPicks } from "@/lib/draft-server";

export async function GET() {
  const picks = await getPicks();
  return NextResponse.json({ picks });
}
