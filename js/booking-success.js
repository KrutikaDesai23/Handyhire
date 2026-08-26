/* =========================================================
   HandyHire - Booking Success JavaScript
   Minimal: the success state is rendered entirely by the
   markup. This script reads the last booking summary
   persisted by booking.js (if any) for future expansion.
   ========================================================= */

(function () {
    'use strict';

    // Role guard: this page belongs to the customer booking flow.
    // A worker token is redirected to provider-home.html by requireRole.
    if (!(window.HandyHireAPI && window.HandyHireAPI.requireRole('customer'))) return;


    /**
     * Try to read the booking summary persisted by booking.js.
     * The shape now includes the real backend response:
     *   { bookingId, workerId, workerName, booking_date,
     *     booking_time, address, hours, amount, total, status }
     * @returns {Object|null}
     */
    function readLastBooking() {
        try {
            const raw = sessionStorage.getItem('handyhire.lastBooking');
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Initialize the Booking Success page.
     */
    function init() {
        // Read the real summary so downstream pages/tabs can
        // rely on the backend booking ID as the source of truth.
        readLastBooking();
    }

    // Run after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
