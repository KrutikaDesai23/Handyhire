-- Migration: Add profile image support for customers/users
-- Run this against the existing PostgreSQL/Neon database.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS profile_image VARCHAR(500);
