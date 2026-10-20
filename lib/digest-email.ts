import { escapeHtml } from "./format";
import { renderEmailHtml } from "./email-template";
import { renderLeaderboardTable, renderLeaderboardText, type LeaderboardEmailRow } from "./leaderboard-email";

export type DigestEmailInput = {
  name: string;
  poolName: string;
  week: number;
  recap: string;
  rows: LeaderboardEmailRow[];
  link: string;
};

const ACCENT_900 = "#2b2741"; // the app's own "highlighted card" background (e.g. a user's own row)
const DIVIDER = "rgba(233,233,237,0.16)";

/** Subject and body for the Tuesday weekly digest email -- built on the shared default template
 * (lib/email-template.ts), with its own recap card and the leaderboard rendered as markup
 * (lib/leaderboard-email.ts) rather than a hosted image. */
export function buildDigestEmail({ name, poolName, week, recap, rows, link }: DigestEmailInput): { subject: string; html: string; text: string } {
  const subject = `[Wins Pool] Week ${week} Recap - ${poolName}`;

  const bodyHtml = `
    <p style="margin:0 0 14px;">Hi ${escapeHtml(name)},</p>
    <p style="margin:0 0 18px;">Here's your weekly recap for <strong>${escapeHtml(poolName)}</strong>.</p>
    <div style="background:${ACCENT_900}; border:1px solid ${DIVIDER}; border-radius:14px; padding:18px 20px; margin:0 0 22px; white-space:pre-line;">${escapeHtml(recap)}</div>
    ${renderLeaderboardTable(rows)}
  `;

  const html = renderEmailHtml({ title: poolName, subtitle: `Week ${week} Recap`, bodyHtml, ctaText: "View your pool", ctaHref: link });
  const text = `Hi ${name},\n\nHere's your weekly recap for ${poolName}.\n\n${recap}\n\n${renderLeaderboardText(rows)}\n\n${link}`;

  return { subject, html, text };
}
