/* =========================================================
   HandyHire - Activity API Fast Path
   Redirects only Activity LIST reads to optimized backend
   endpoints. Status updates/details keep their existing routes.
   ========================================================= */

(function () {
    'use strict';

    var api = window.HandyHireAPI;
    if (!api || typeof api.apiFetch !== 'function' || api.__activityFastPath) {
        return;
    }

    var originalApiFetch = api.apiFetch.bind(api);

    api.apiFetch = function (path, options) {
        var method = String(options && options.method ? options.method : 'GET').toUpperCase();
        var target = path;

        if (method === 'GET') {
            if (path === '/api/bookings/customer/bookings') {
                target = '/api/activity/customer';
            } else if (path === '/api/worker/bookings') {
                target = '/api/activity/provider/received';
            } else if (path === '/api/worker/bookings/sent') {
                target = '/api/activity/provider/sent';
            }
        }

        return originalApiFetch(target, options);
    };

    api.__activityFastPath = true;
})();
