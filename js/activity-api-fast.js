/* =========================================================
   HandyHire - Activity API Compatibility
   Keep Activity pages on their real backend routes:
   - Customer: /api/bookings/customer/bookings
   - Provider received: /api/worker/bookings
   - Provider sent: /api/worker/bookings/sent

   The old fast-path rewrote these to /api/activity/* routes,
   but no such router is registered by the backend.
   ========================================================= */

(function () {
    'use strict';

    // Intentionally do not rewrite Activity API requests.
    // The routes used by activity.js and provider-activity.js
    // are implemented by the existing bookings routers.
})();
