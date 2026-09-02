(function () {
    'use strict';

    function readLastBooking() {
        try {
            const raw =
                sessionStorage.getItem(
                    'handyhire.lastBooking'
                );

            if (!raw) return null;

            const booking =
                JSON.parse(raw);

            return (
                booking &&
                typeof booking === 'object'
            )
                ? booking
                : null;
        } catch (error) {
            return null;
        }
    }

    function formatDate(value) {
        if (!value) return '--';

        const parts =
            String(value).split('-');

        if (parts.length !== 3) {
            return value;
        }

        const date = new Date(
            Number(parts[0]),
            Number(parts[1]) - 1,
            Number(parts[2])
        );

        return date.toLocaleDateString(
            'en-IN',
            {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            }
        );
    }

    function formatTime(value) {
        if (!value) return '--';

        const parts =
            String(value).split(':');

        const hour =
            Number(parts[0]);

        const minute =
            Number(parts[1]) || 0;

        if (!Number.isFinite(hour)) {
            return value;
        }

        const suffix =
            hour >= 12
                ? 'PM'
                : 'AM';

        const displayHour =
            hour % 12 || 12;

        return (
            displayHour +
            ':' +
            String(minute).padStart(2, '0') +
            ' ' +
            suffix
        );
    }

    function setText(id, value) {
        const element =
            document.getElementById(id);

        if (element) {
            element.textContent = value;
        }
    }

    function init() {
        const booking =
            readLastBooking();

        if (!booking) {
            setText(
                'successTitle',
                'Booking Request Sent'
            );

            setText(
                'successSubtitle',
                'Your booking request was created successfully.'
            );

            return;
        }

        setText(
            'successTitle',
            'Booking Request Sent'
        );

        setText(
            'successSubtitle',
            booking.package_type === 'team'
                ? 'Your team package booking request was sent.'
                : booking.package_type === 'multitasking'
                    ? 'Your multitasking package booking request was sent.'
                    : 'The worker will review your request.'
        );

        setText(
            'successBookingId',
            'Booking ID: #' +
                booking.id
        );

        setText(
            'successWorker',
            booking.package_id
                ? 'Package: ' +
                    (booking.package_name ||
                    booking.worker ||
                    'Team Package')
                : 'Worker: ' +
                    booking.worker
        );

        setText(
            'successSchedule',
            'Schedule: ' +
                formatDate(booking.date) +
                ' at ' +
                formatTime(booking.time) +
                (booking.package_id && booking.hours
                    ? ' (' + booking.hours + ' hr)'
                    : '')
        );

        setText(
            'successAmount',
            'Total: \u20B9' +
                Number(
                    booking.total || 0
                ).toLocaleString('en-IN')
        );
    }

    if (
        document.readyState ===
        'loading'
    ) {
        document.addEventListener(
            'DOMContentLoaded',
            init
        );
    } else {
        init();
    }
})();