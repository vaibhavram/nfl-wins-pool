import "server-only";
import { createHmac } from "crypto";

/** HMAC-SHA256 of a phone number's last 10 digits -- never store or log the plaintext number.
 * Same normalization the legacy app's MANAGER_PHONES lookup already used (`.replace(/\D/g,
 * "").slice(-10)`), so a legacy manager's number hashes identically here and there. Dedicated
 * PHONE_HMAC_SECRET (not SESSION_SECRET or MIGRATE_SECRET) so a leaked signing key can't also
 * be used to test candidate phone numbers against the stored hashes. */
export function hashPhone(rawPhone: string): string {
  const secret = process.env.PHONE_HMAC_SECRET;
  if (!secret) throw new Error("PHONE_HMAC_SECRET is not set");
  const digits = rawPhone.replace(/\D/g, "").slice(-10);
  return createHmac("sha256", secret).update(digits).digest("hex");
}
