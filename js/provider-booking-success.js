/* =========================================================
   HandyHire - Booking Success JavaScript
   Minimal: the success state is rendered entirely by the
   markup. This script exists so the page can read the
   last booking summary persisted by booking.js (if any)
   for future expansion, and to keep the interaction
   surface consistent with the rest of the project.
   ========================================================= */

(function () {
    'use strict';

    /**
     * Try to read the booking summary persisted by booking.js.
     * The shape is:
     *   { worker: string, date: 'YYYY-MM-DD',
     *     hours: number, total: number }
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
        // Reserved for future enhancements (toast, analytics,
        // navigation guards, etc.). The visible UI is fully
        // declarative in the markup.
        readLastBooking();
    }

    // Run after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
