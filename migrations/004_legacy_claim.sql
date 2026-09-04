-- Makes a claimed legacy placeholder's fate queryable instead of only inferable from the
-- absence of any pool_members/season_managers/season_picks rows pointing at it.
ALTER TABLE users ADD COLUMN claimed_by UUID REFERENCES users(id);
