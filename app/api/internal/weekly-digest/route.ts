import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getWeeklyDigests } from "@/lib/weekly-digest";
import { renderLeaderboardImage } from "@/lib/leaderboard-image";
import { storeEmailImage } from "@/lib/email-image-store";
import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/format";

// Same MIGRATE_SECRET bearer gate as the other /api/internal routes. Meant to be called once a
// week (Tuesday morning) by an external scheduler -- see the Railway cron service pointed at this
// endpoint. `dryRun: true` returns each pool's generated recap and recipient list without
// rendering an image or sending anything, so a bad recap can be caught before it goes out.
// `previewTo: "you@example.com"` renders the real image and sends the real content for every
// in-season pool, but to that one address instead of each pool's actual roster -- for checking
// how the finished email actually looks in an inbox without emailing anyone else.
export async function POST(req: Request) {
  const secret = process.env.MIGRATE_SECRET;
  if (!secret) return NextResponse.json({ error: "MIGRATE_SECRET not configured" }, { status: 500 });

  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  const authorized = a.length === b.length && timingSafeEqual(a, b);
  if (!authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dryRun === true;
  const previewTo: string | null = typeof body?.previewTo === "string" ? body.previewTo : null;

  try {
    const digests = await getWeeklyDigests();

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        pools: digests.map((d) => ({
          slug: d.slug,
          name: d.name,
          week: d.week,
          prompt: d.prompt,
          recap: d.recap,
          recipients: d.recipients.map((r) => r.email),
        })),
      });
    }

    const appUrl = process.env.APP_URL ?? new URL(req.url).origin;
    let sent = 0;

    for (const d of digests) {
      const recipients = previewTo ? [{ email: previewTo, name: previewTo }] : d.recipients;
      if (recipients.length === 0) continue;
      const imageBuffer = await renderLeaderboardImage(d.name, d.standingsRows);
      const imageToken = storeEmailImage(imageBuffer);
      const imageUrl = `${appUrl}/api/email-image/${imageToken}`;
      const link = `${appUrl}/p/${d.slug}/standings`;
      const subject = `${previewTo ? "[PREVIEW] " : ""}${d.name}: Week ${d.week} recap`;
      const html = `<p>${escapeHtml(d.recap)}</p><p><img src="${imageUrl}" alt="${escapeHtml(d.name)} standings" width="640" /></p><p><a href="${link}">View your pool</a></p>`;
      const text = `${d.recap}\n\n${link}`;

      for (const r of recipients) {
        await sendEmail({ to: r.email, subject, html, text });
        sent++;
      }
    }

    return NextResponse.json({ ok: true, pools: digests.length, sent, preview: Boolean(previewTo) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
