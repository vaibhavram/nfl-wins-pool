-- Rate-limits POST /api/claim/lookup the same way auth_links already rate-limits sign-in
-- requests -- a phone-number lookup is public/unauthenticated, so it needs its own throttle.
CREATE TABLE claim_lookup_attempts (
  id BIGSERIAL PRIMARY KEY,
  phone_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX claim_lookup_attempts_phone_hash_idx ON claim_lookup_attempts (phone_hash, created_at);
