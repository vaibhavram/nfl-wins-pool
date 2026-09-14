import { escapeHtml } from "./format";

export type DigestEmailInput = { name: string; poolName: string; week: number; recap: string; imageUrl: string; link: string };

/** Subject and body for the Tuesday weekly digest email -- a warm, playful template (Google
 * Fonts for a friendlier display face than the system default; falls back gracefully to
 * Trebuchet/Verdana wherever a client won't load the web font) instead of a plain-text-looking
 * block, per explicit ask. */
export function buildDigestEmail({ name, poolName, week, recap, imageUrl, link }: DigestEmailInput): { subject: string; html: string; text: string } {
  const subject = `[Wins Pool] Week ${week} Recap - ${poolName}`;

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700&family=Nunito:wght@400;600;700&display=swap" rel="stylesheet" />
  </head>
  <body style="margin:0; padding:24px 16px; background:#f4ece0; font-family:'Nunito','Trebuchet MS',Verdana,sans-serif;">
    <div style="max-width:560px; margin:0 auto; background:#fffdf9; border-radius:18px; overflow:hidden; border:1px solid #ecdfc9; box-shadow:0 2px 12px rgba(60,40,20,0.06);">
      <div style="background:linear-gradient(135deg,#ff7a52,#ff5b7a); padding:24px 26px;">
        <div style="font-family:'Baloo 2','Trebuchet MS',sans-serif; font-size:22px; font-weight:700; color:#ffffff;">🏈 ${escapeHtml(poolName)}</div>
        <div style="font-family:'Nunito','Trebuchet MS',sans-serif; font-size:12.5px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:#ffe4dd; margin-top:4px;">Week ${week} Recap</div>
      </div>
      <div style="padding:26px;">
        <p style="margin:0 0 14px; font-size:15px; color:#33291f;">Hi ${escapeHtml(name)},</p>
        <p style="margin:0 0 18px; font-size:15px; color:#33291f;">Here's your weekly recap for <strong>${escapeHtml(poolName)}</strong>.</p>
        <div style="background:#fff6ec; border:1px solid #f3e3cc; border-radius:14px; padding:18px 20px; margin:0 0 22px; font-size:15px; line-height:1.6; color:#33291f; white-space:pre-line;">${escapeHtml(recap)}</div>
        <img src="${imageUrl}" alt="${escapeHtml(poolName)} standings" width="100%" style="border-radius:14px; display:block; margin:0 0 22px; border:1px solid #ecdfc9;" />
        <a href="${link}" style="display:inline-block; background:#ff5b7a; color:#ffffff; text-decoration:none; padding:11px 22px; border-radius:10px; font-family:'Baloo 2','Trebuchet MS',sans-serif; font-size:14px; font-weight:700;">View your pool &rarr;</a>
      </div>
    </div>
  </body>
</html>`;

  const text = `Hi ${name},\n\nHere's your weekly recap for ${poolName}.\n\n${recap}\n\n${link}`;

  return { subject, html, text };
}
