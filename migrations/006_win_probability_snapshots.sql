-- Daily record of each manager's Monte Carlo pool-win probability -- until now this was computed
-- on demand and never persisted (5-minute in-memory cache only), so there was no way to look back
-- at how a manager's odds moved over time. One row per manager per pool per day.
CREATE TABLE win_probability_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id     UUID NOT NULL REFERENCES pool_seasons(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id),
  snapshot_date DATE NOT NULL, -- the Pacific-time calendar day the snapshot was taken for
  wins          NUMERIC NOT NULL,
  win_pct       NUMERIC NOT NULL,
  avg_wins      NUMERIC NOT NULL,
  median_wins   NUMERIC NOT NULL,
  p10_wins      NUMERIC NOT NULL,
  p90_wins      NUMERIC NOT NULL,
  trials        INTEGER NOT NULL,
  captured_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (season_id, user_id, snapshot_date)
);
CREATE INDEX win_probability_snapshots_season_date ON win_probability_snapshots (season_id, snapshot_date);
