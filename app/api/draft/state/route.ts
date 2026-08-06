import { NextResponse } from "next/server";
import { getFullState } from "@/lib/draft-server";

export async function GET() {
  const state = await getFullState();
  return NextResponse.json(state);
}
