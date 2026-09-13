import { NextResponse } from "next/server";
import { getEmailImage } from "@/lib/email-image-store";

// Public, unauthenticated -- the token itself (a random 16-byte hex string embedded in one
// email) is the access control, same trust model as this app's invite links.
export async function GET(_req: Request, ctx: RouteContext<"/api/email-image/[token]">) {
  const { token } = await ctx.params;
  const entry = getEmailImage(token);
  if (!entry) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(entry.buffer), {
    headers: { "Content-Type": entry.contentType, "Cache-Control": "public, max-age=1209600, immutable" },
  });
}
