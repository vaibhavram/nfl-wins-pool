import "server-only";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-haiku-4-5-20251001"; // cheap/fast -- plenty for a <100-word recap run once per pool per week

type AnthropicResponse = { content?: { type: string; text?: string }[] };

/** Plain fetch call to Anthropic's Messages API, consistent with how this app already talks to
 * ESPN/FPI/Resend directly rather than pulling in an SDK for one endpoint. Throws if
 * ANTHROPIC_API_KEY isn't set -- unlike lib/email.ts's console fallback, there's no sensible
 * placeholder for a missing LLM recap, so callers should treat this as a hard dependency. */
export async function generateText(prompt: string, maxTokens = 300): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": ANTHROPIC_VERSION, "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic request failed (${res.status}): ${await res.text()}`);
  const data: AnthropicResponse = await res.json();
  const text = data.content?.find((c) => c.type === "text")?.text;
  if (typeof text !== "string") throw new Error("Anthropic response missing text content");
  return text.trim();
}
