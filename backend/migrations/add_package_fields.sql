-- Migration: Add package management fields to packages table
-- Run this against your existing PostgreSQL/Neon database.
-- For SQLite (handyhire.db), run: sqlite3 handyhire.db < migrations/add_package_fields.sql

ALTER TABLE packages ADD COLUMN IF NOT EXISTS duration VARCHAR(100);
ALTER TABLE packages ADD COLUMN IF NOT EXISTS location VARCHAR(255);
ALTER TABLE packages ADD COLUMN IF NOT EXISTS availability VARCHAR(100);
ALTER TABLE packages ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'draft';
ALTER TABLE packages ADD COLUMN IF NOT EXISTS owner_id INTEGER NOT NULL DEFAULT 0;

-- Backfill owner_id from existing package_services where possible
-- (this is a best-effort guess; adjust as needed for your data)
-- UPDATE packages SET owner_id = 1 WHERE owner_id = 0;

-- Add foreign key constraint (compatible with PostgreSQL)
-- Note: SQLite does not support ALTER TABLE ADD CONSTRAINT,
-- so this is for PostgreSQL only. Adjust or run manually if needed.
-- ALTER TABLE packages ADD CONSTRAINT fk_packages_owner
--     FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;

-- For existing rows that may have NULL in new NOT NULL columns,
-- the DEFAULT values above handle that for duration/location/availability
-- since they are nullable. status has a DEFAULT 'draft'.
