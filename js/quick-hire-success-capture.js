/* =========================================================
   HandyHire - Quick Hire success capture
   Remembers a newly-created Quick Hire so Home can show the
   live booking tracker. Runs only when the success page was
   reached from quick-hire.html.
   ========================================================= */

(function () {
    'use strict';

    function cameFromQuickHire() {
        try {
            return /(?:^|\/)quick-hire\.html(?:[?#]|$)/i.test(document.referrer || '');
        } catch (e) {
            return false;
        }
    }

    function getBookingId() {
        try {
            const params = new URLSearchParams(window.location.search);
            const raw = params.get('booking_id');
            if (!raw) return null;
            const id = Number(raw);
            return Number.isFinite(id) && id > 0 ? String(id) : null;
        } catch (e) {
            return null;
        }
    }

    function getStoredUser() {
        try {
            const raw = localStorage.getItem('handyhire.auth.user');
            if (!raw) return null;
            const user = JSON.parse(raw);
            return user && typeof user === 'object' ? user : null;
        } catch (e) {
            return null;
        }
    }

    function init() {
        if (!cameFromQuickHire()) return;

        const bookingId = getBookingId();
        const user = getStoredUser();
        const ownerId = user && (user.id != null ? user.id : user.user_id);
        if (!bookingId || ownerId == null) return;

        const record = {
            bookingId: bookingId,
            ownerId: String(ownerId),
            ownerRole: user.role || null,
            createdAt: new Date().toISOString(),
        };

        try {
            localStorage.setItem(
                'handyhire.activeQuickHire.' + String(ownerId),
                JSON.stringify(record)
            );
            localStorage.setItem(
                'handyhire.activeQuickHire.latest',
                JSON.stringify(record)
            );
        } catch (e) {
            // The booking itself is already confirmed; tracker storage is optional.
        }
    }

    init();
})();
