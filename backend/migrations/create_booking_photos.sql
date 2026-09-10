-- Migration: Create booking_photos table
-- Stores customer-uploaded job photos (before/after) associated with a booking.
-- Follows the existing file-path approach: only the static URL is stored,
-- never the image binary itself.
-- Run this against your existing PostgreSQL/Neon database.
-- For SQLite (handyhire.db), run: sqlite3 handyhire.db < migrations/create_booking_photos.sql

CREATE TABLE IF NOT EXISTS booking_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    photo_type VARCHAR(10) NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups by booking_id
CREATE INDEX IF NOT EXISTS ix_booking_photos_booking_id
    ON booking_photos(booking_id);
