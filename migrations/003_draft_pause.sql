-- Lets the commissioner pause a live draft. paused_at marks "currently paused"; clock_reset_at
-- gives whoever's on the clock a fresh full pick-clock window on resume (rather than trying to
-- precisely preserve remaining time across a pause, which would require rewriting historical
-- pick timestamps).
ALTER TABLE pool_seasons ADD COLUMN paused_at TIMESTAMPTZ;
ALTER TABLE pool_seasons ADD COLUMN clock_reset_at TIMESTAMPTZ;
