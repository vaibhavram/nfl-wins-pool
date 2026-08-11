-- Multi-tenant schema for the new product. Lives entirely in its own database
-- (DATABASE_URL_V2) -- never applied to, or read from, the legacy single-pool
-- database (DATABASE_URL / lib/db.ts).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Identity
CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT,               -- NULL until a legacy user claims, or immediately for new signups
  display_name        TEXT NOT NULL,
  legacy_manager_name TEXT,                -- set only for the 10 managers migrated from the legacy pool
  legacy_phone_hmac   TEXT,                -- HMAC-SHA256(last-10-digits, PHONE_HMAC_SECRET); never plaintext
  claimed_at          TIMESTAMPTZ,
  token_version       INTEGER NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_key ON users (email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX users_phone_key ON users (legacy_phone_hmac) WHERE legacy_phone_hmac IS NOT NULL;

-- Pool = the recurring group
CREATE TABLE pools (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT NOT NULL UNIQUE,         -- URLs: /p/<slug>
  name       TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  is_legacy  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pool_members (
  pool_id   UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id),
  seat_no   INTEGER NOT NULL CHECK (seat_no BETWEEN 1 AND 10),
  role      TEXT NOT NULL DEFAULT 'manager' CHECK (role IN ('commissioner', 'manager')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (pool_id, user_id),
  UNIQUE (pool_id, seat_no)                -- DB-enforced 10-seat cap, no counting race
);
CREATE UNIQUE INDEX pool_one_commissioner ON pool_members (pool_id) WHERE role = 'commissioner';

-- Season = one instance of the group
CREATE TABLE pool_seasons (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id            UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  season_year        INTEGER NOT NULL,
  status             TEXT NOT NULL DEFAULT 'filling'
                       CHECK (status IN ('filling', 'ready', 'drafting', 'in_season', 'final')),
  pick_clock_seconds INTEGER NOT NULL DEFAULT 43200,  -- 12h default
  draft_started_at   TIMESTAMPTZ,
  draft_completed_at TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pool_id, season_year)
);

-- Frozen roster + randomized draft order for one season, assigned once at filling -> ready
CREATE TABLE season_managers (
  season_id      UUID NOT NULL REFERENCES pool_seasons(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id),
  display_name   TEXT NOT NULL,             -- snapshotted at join time
  draft_position INTEGER NOT NULL CHECK (draft_position BETWEEN 1 AND 10),
  PRIMARY KEY (season_id, user_id),
  UNIQUE (season_id, draft_position)
);

CREATE TABLE season_picks (
  season_id  UUID NOT NULL REFERENCES pool_seasons(id) ON DELETE CASCADE,
  pick_no    INTEGER NOT NULL CHECK (pick_no BETWEEN 1 AND 30),
  user_id    UUID NOT NULL REFERENCES users(id),
  team_ab    TEXT NOT NULL,
  auto       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (season_id, pick_no),
  UNIQUE (season_id, team_ab)                -- per-season uniqueness, not global
);

CREATE TABLE season_events (
  id         BIGSERIAL PRIMARY KEY,
  season_id  UUID NOT NULL REFERENCES pool_seasons(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  pick_no    INTEGER,
  user_id    UUID REFERENCES users(id),
  team_ab    TEXT,
  payload    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX season_events_season_idx ON season_events (season_id, id);

CREATE TABLE season_presence (
  season_id UUID NOT NULL REFERENCES pool_seasons(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (season_id, user_id)
);

CREATE TABLE pool_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id     UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  kind        TEXT NOT NULL CHECK (kind IN ('link', 'email')),
  email       TEXT,                         -- non-null only for kind='email'
  created_by  UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ,                  -- NULL = never, for the durable share link
  revoked_at  TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES users(id)
);
CREATE UNIQUE INDEX pool_one_share_link ON pool_invites (pool_id) WHERE kind = 'link' AND revoked_at IS NULL;

-- Magic links: stateless sessions, single-use links
CREATE TABLE auth_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash  TEXT NOT NULL UNIQUE,          -- sha256(raw token); raw token is never stored
  email       TEXT NOT NULL,
  user_id     UUID REFERENCES users(id),     -- pinned for purpose='claim'
  purpose     TEXT NOT NULL CHECK (purpose IN ('sign_in', 'join_pool', 'claim')),
  redirect_to TEXT,
  request_ip  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ
);
CREATE INDEX auth_links_rate_idx ON auth_links (email, created_at DESC);
