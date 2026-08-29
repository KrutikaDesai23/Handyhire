-- Migration: Create package_members association table
-- Run this against your existing PostgreSQL/Neon database.
-- For SQLite (handyhire.db), run: sqlite3 handyhire.db < migrations/create_package_members.sql

-- Association table linking packages to team_members
CREATE TABLE IF NOT EXISTS package_members (
    package_id INTEGER NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    team_member_id INTEGER NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    PRIMARY KEY (package_id, team_member_id)
);

-- Index for faster lookups by team_member_id
CREATE INDEX IF NOT EXISTS idx_package_members_team_member_id
    ON package_members(team_member_id);
