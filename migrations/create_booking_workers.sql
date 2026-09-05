CREATE TABLE IF NOT EXISTS booking_workers (
    booking_id INTEGER NOT NULL
        REFERENCES bookings(id) ON DELETE CASCADE,
    worker_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (booking_id, worker_id)
);

CREATE INDEX IF NOT EXISTS idx_booking_workers_worker_id
ON booking_workers(worker_id);

ALTER TABLE booking_workers
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending';

ALTER TABLE booking_workers
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE booking_workers
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
