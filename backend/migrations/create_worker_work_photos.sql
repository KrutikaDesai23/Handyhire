-- Migration: Create worker_work_photos table
-- Stores worker-uploaded portfolio photos of previous work.
-- These photos belong to the WORKER (users.id), NOT to a booking.
-- This is separate from the booking_photos table and must not be
-- merged or reused for booking photos.
-- Run this against your existing PostgreSQL/Neon database.

CREATE TABLE IF NOT EXISTS worker_work_photos (
    id SERIAL PRIMARY KEY,
    worker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image_url VARCHAR(500) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups by worker_id
CREATE INDEX IF NOT EXISTS ix_worker_work_photos_worker_id
    ON worker_work_photos(worker_id);
