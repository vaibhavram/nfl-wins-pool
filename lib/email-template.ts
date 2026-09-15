import { escapeHtml } from "./format";

// Shared visual identity for every email this app sends -- colors lifted directly from
// app/globals.css's "Nocturne" token set (dark bg/surface, lavender accent), inlined as static
// hex since email clients don't support CSS custom properties or color-mix() reliably. Originally
// built for the weekly digest; promoted to the default template for every email (auth links,
// reminders, etc.) so nothing in the app looks like a bare, unstyled system email anymore.
const BG = "#161826"; // --color-bg
const SURFACE = "#232532"; // --color-surface
const TEXT = "#e9e9ed"; // --color-text
const ACCENT = "#9184d9"; // --color-accent
const ACCENT_300 = "#d2cefd";
const ACCENT_700 = "#5d5294";
const NEUTRAL_400 = "#b2b6ca";
const DIVIDER = "rgba(233,233,237,0.16)"; // --color-divider, without color-mix() (unsupported in most email clients)

export type EmailTemplateInput = {
  title: string; // header line -- "The Wins Pool" for account/auth emails, a pool's own name for pool-scoped ones
  subtitle?: string; // small uppercase line under the title, e.g. "Sign-in link", "Week 1 Recap"
  bodyHtml: string; // inner content (paragraphs, cards, images) -- caller-composed, already escaped where needed
  ctaText?: string;
  ctaHref?: string;
};

/** Wraps arbitrary body content in this app's default email shell: dark gradient header with the
 * Baloo 2 display face, card body in Nunito, an optional outlined CTA button matching the app's
 * own .btn-primary style (outlined, not filled), and a small sign-off line. */
export function renderEmailHtml({ title, subtitle, bodyHtml, ctaText, ctaHref }: EmailTemplateInput): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700&family=Nunito:wght@400;600;700&display=swap" rel="stylesheet" />
  </head>
  <body style="margin:0; padding:24px 16px; background:${BG}; font-family:'Nunito','Trebuchet MS',Verdana,sans-serif;">
    <div style="max-width:560px; margin:0 auto; background:${SURFACE}; border-radius:18px; overflow:hidden; border:1px solid ${DIVIDER};">
      <div style="background:linear-gradient(135deg,${ACCENT_700},${ACCENT}); padding:24px 26px;">
        <div style="font-family:'Baloo 2','Trebuchet MS',sans-serif; font-size:22px; font-weight:700; color:#ffffff;">🏈 ${escapeHtml(title)}</div>
        ${subtitle ? `<div style="font-family:'Nunito','Trebuchet MS',sans-serif; font-size:12.5px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:${ACCENT_300}; margin-top:4px;">${escapeHtml(subtitle)}</div>` : ""}
      </div>
      <div style="padding:26px; font-size:15px; line-height:1.6; color:${TEXT};">
        ${bodyHtml}
        ${
          ctaText && ctaHref
            ? `<a href="${ctaHref}" style="display:inline-block; background:transparent; color:${ACCENT_300}; text-decoration:none; padding:10px 21px; border-radius:10px; border:1px solid ${ACCENT}; font-family:'Baloo 2','Trebuchet MS',sans-serif; font-size:14px; font-weight:700; margin-top:4px;">${escapeHtml(ctaText)} &rarr;</a>`
            : ""
        }
        <p style="margin:22px 0 0; font-size:11.5px; color:${NEUTRAL_400};">The Wins Pool</p>
      </div>
    </div>
  </body>
</html>`;
}

/** A single paragraph, styled to match the template's body text -- the common case for the
 * simple one-or-two-sentence emails (auth links, reminders) that don't need digest-email.ts's
 * richer card/image layout. */
export function emailParagraph(text: string): string {
  return `<p style="margin:0 0 14px;">${escapeHtml(text)}</p>`;
}
