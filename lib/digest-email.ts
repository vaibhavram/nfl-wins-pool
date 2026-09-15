import { escapeHtml } from "./format";

export type DigestEmailInput = { name: string; poolName: string; week: number; recap: string; imageUrl: string; link: string };

// Lifted from app/globals.css's "Nocturne" token set -- email clients don't support CSS custom
// properties reliably (Outlook especially), so these are the same values inlined as static hex.
const BG = "#161826"; // --color-bg
const SURFACE = "#232532"; // --color-surface
const TEXT = "#e9e9ed"; // --color-text
const ACCENT = "#9184d9"; // --color-accent
const ACCENT_300 = "#d2cefd";
const ACCENT_700 = "#5d5294";
const ACCENT_900 = "#2b2741"; // the app's own "highlighted card" background (e.g. a user's own row)
const NEUTRAL_400 = "#b2b6ca";
const DIVIDER = "rgba(233,233,237,0.16)"; // --color-divider, without color-mix() (unsupported in most email clients)

/** Subject and body for the Tuesday weekly digest email -- styled to match the app's own dark,
 * lavender-accented "Nocturne" theme (see app/globals.css) rather than an unrelated palette,
 * with Google Fonts for a bit of personality (Baloo 2 for the pool name, Nunito for body copy)
 * layered on top of that same color system. */
export function buildDigestEmail({ name, poolName, week, recap, imageUrl, link }: DigestEmailInput): { subject: string; html: string; text: string } {
  const subject = `[Wins Pool] Week ${week} Recap - ${poolName}`;

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700&family=Nunito:wght@400;600;700&display=swap" rel="stylesheet" />
  </head>
  <body style="margin:0; padding:24px 16px; background:${BG}; font-family:'Nunito','Trebuchet MS',Verdana,sans-serif;">
    <div style="max-width:560px; margin:0 auto; background:${SURFACE}; border-radius:18px; overflow:hidden; border:1px solid ${DIVIDER};">
      <div style="background:linear-gradient(135deg,${ACCENT_700},${ACCENT}); padding:24px 26px;">
        <div style="font-family:'Baloo 2','Trebuchet MS',sans-serif; font-size:22px; font-weight:700; color:#ffffff;">🏈 ${escapeHtml(poolName)}</div>
        <div style="font-family:'Nunito','Trebuchet MS',sans-serif; font-size:12.5px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:${ACCENT_300}; margin-top:4px;">Week ${week} Recap</div>
      </div>
      <div style="padding:26px;">
        <p style="margin:0 0 14px; font-size:15px; color:${TEXT};">Hi ${escapeHtml(name)},</p>
        <p style="margin:0 0 18px; font-size:15px; color:${TEXT};">Here's your weekly recap for <strong>${escapeHtml(poolName)}</strong>.</p>
        <div style="background:${ACCENT_900}; border:1px solid ${DIVIDER}; border-radius:14px; padding:18px 20px; margin:0 0 22px; font-size:15px; line-height:1.6; color:${TEXT}; white-space:pre-line;">${escapeHtml(recap)}</div>
        <img src="${imageUrl}" alt="${escapeHtml(poolName)} standings" width="100%" style="border-radius:14px; display:block; margin:0 0 22px; border:1px solid ${DIVIDER};" />
        <a href="${link}" style="display:inline-block; background:transparent; color:${ACCENT_300}; text-decoration:none; padding:10px 21px; border-radius:10px; border:1px solid ${ACCENT}; font-family:'Baloo 2','Trebuchet MS',sans-serif; font-size:14px; font-weight:700;">View your pool &rarr;</a>
        <p style="margin:22px 0 0; font-size:11.5px; color:${NEUTRAL_400};">The Wins Pool</p>
      </div>
    </div>
  </body>
</html>`;

  const text = `Hi ${name},\n\nHere's your weekly recap for ${poolName}.\n\n${recap}\n\n${link}`;

  return { subject, html, text };
}
