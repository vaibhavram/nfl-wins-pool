import { NextResponse } from "next/server";
import { getNfeloRatings } from "@/lib/nfelo";

export async function GET() {
  const ratings = await getNfeloRatings();
  return NextResponse.json({ ratings });
}
