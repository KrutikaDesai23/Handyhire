-- Migration: Create package_workers association table
-- Run this against your existing PostgreSQL/Neon database.
-- For SQLite (handyhire.db), run: sqlite3 handyhire.db < migrations/create_package_workers.sql

CREATE TABLE IF NOT EXISTS package_workers (
    package_id INTEGER NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    worker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (package_id, worker_id)
);

-- Index for faster lookups by worker_id
CREATE INDEX IF NOT EXISTS idx_package_workers_worker_id
    ON package_workers(worker_id);
