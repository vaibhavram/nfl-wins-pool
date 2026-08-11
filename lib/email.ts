import "server-only";

type SendEmailArgs = { to: string; subject: string; html: string; text: string };

/** Resend via a plain fetch call (no SDK dependency, consistent with how this app already
 * talks to ESPN/nfelo/FPI directly). Falls back to logging the email to stdout when
 * RESEND_API_KEY isn't set yet, so auth can be built/tested before the owner has a verified
 * sending domain. */
export async function sendEmail({ to, subject, html, text }: SendEmailArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[email:console] to=${to} subject="${subject}"\n${text}`);
    return;
  }
  const from = process.env.MAIL_FROM;
  if (!from) throw new Error("MAIL_FROM env var is not set");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  if (!res.ok) throw new Error(`Resend request failed (${res.status}): ${await res.text()}`);
}
