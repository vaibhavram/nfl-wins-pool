import { escapeHtml } from "./format";
import { renderEmailHtml } from "./email-template";

export type DigestEmailInput = { name: string; poolName: string; week: number; recap: string; imageUrl: string; link: string };

const ACCENT_900 = "#2b2741"; // the app's own "highlighted card" background (e.g. a user's own row)
const DIVIDER = "rgba(233,233,237,0.16)";

/** Subject and body for the Tuesday weekly digest email -- built on the shared default template
 * (lib/email-template.ts), with its own recap card + leaderboard image in the body slot. */
export function buildDigestEmail({ name, poolName, week, recap, imageUrl, link }: DigestEmailInput): { subject: string; html: string; text: string } {
  const subject = `[Wins Pool] Week ${week} Recap - ${poolName}`;

  const bodyHtml = `
    <p style="margin:0 0 14px;">Hi ${escapeHtml(name)},</p>
    <p style="margin:0 0 18px;">Here's your weekly recap for <strong>${escapeHtml(poolName)}</strong>.</p>
    <div style="background:${ACCENT_900}; border:1px solid ${DIVIDER}; border-radius:14px; padding:18px 20px; margin:0 0 22px; white-space:pre-line;">${escapeHtml(recap)}</div>
    <img src="${imageUrl}" alt="${escapeHtml(poolName)} standings" width="100%" style="border-radius:14px; display:block; margin:0 0 22px; border:1px solid ${DIVIDER};" />
  `;

  const html = renderEmailHtml({ title: poolName, subtitle: `Week ${week} Recap`, bodyHtml, ctaText: "View your pool", ctaHref: link });
  const text = `Hi ${name},\n\nHere's your weekly recap for ${poolName}.\n\n${recap}\n\n${link}`;

  return { subject, html, text };
}
