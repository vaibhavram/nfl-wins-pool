import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { acceptInvite } from "@/lib/invites-server";

export async function POST(_req: Request, ctx: RouteContext<"/api/invites/[token]/accept">) {
  const { token } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  const result = await acceptInvite(token, user.id);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
