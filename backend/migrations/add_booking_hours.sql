-- Add booking duration so the backend can prevent overlapping jobs.
-- Existing bookings are treated as one-hour bookings for backward compatibility.

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS hours INTEGER;

UPDATE bookings
SET hours = 1
WHERE hours IS NULL;

ALTER TABLE bookings
ALTER COLUMN hours SET DEFAULT 1;

ALTER TABLE bookings
ALTER COLUMN hours SET NOT NULL;
