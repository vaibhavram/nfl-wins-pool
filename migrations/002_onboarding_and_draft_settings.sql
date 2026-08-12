-- Onboarding fields, collected once at first sign-up.
ALTER TABLE users ADD COLUMN username TEXT;
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN onboarded_at TIMESTAMPTZ;
CREATE UNIQUE INDEX users_username_key ON users (lower(username)) WHERE username IS NOT NULL;

-- Commissioner-set scheduled draft date/time (distinct from draft_started_at, which records
-- when the draft actually started).
ALTER TABLE pool_seasons ADD COLUMN scheduled_draft_at TIMESTAMPTZ;
