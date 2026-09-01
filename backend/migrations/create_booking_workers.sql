-- Migration: Create booking_workers association table
-- Run this against your existing PostgreSQL/Neon database.
-- For SQLite (handyhire.db), run: sqlite3 handyhire.db < migrations/create_booking_workers.sql
--
-- This table snapshots the selected Team Package workers at booking time.
-- It is additive and does not modify any existing table.

CREATE TABLE IF NOT EXISTS booking_workers (
    booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    worker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    role VARCHAR(100),
    PRIMARY KEY (booking_id, worker_id)
);

-- Index for fast lookup of all bookings that include a given worker
-- (used for member Activity visibility queries).
CREATE INDEX IF NOT EXISTS idx_booking_workers_worker_id
    ON booking_workers(worker_id);

-- Index for fast cleanup when a booking is deleted.
CREATE INDEX IF NOT EXISTS idx_booking_workers_booking_id
    ON booking_workers(booking_id);
