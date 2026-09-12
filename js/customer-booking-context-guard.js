/* =========================================================
   HandyHire - Customer Booking Context Guard
   Prevents stale package/team selection from leaking into
   a normal individual-worker booking flow.
   ========================================================= */

(function () {
    'use strict';

    var NON_WORKER_CONTEXT_KEYS = [
        'handyhire.selectedPackageId',
        'handyhire.selectedPackage',
        'handyhire.selectedTeamPackage',
        'handyhire.selectedTeam',
        'handyhire.selectedTeamId',
        'handyhire.selectedMember',
        'handyhire.bookingMode'
    ];

    function clearNonWorkerContext() {
        try {
            NON_WORKER_CONTEXT_KEYS.forEach(function (key) {
                sessionStorage.removeItem(key);
            });
        } catch (error) {
            // Continue even when storage is unavailable.
        }
    }

    function readStoredWorkerId() {
        try {
            var value = sessionStorage.getItem('handyhire.selectedWorkerId');
            return value && String(value).trim() ? String(value).trim() : null;
        } catch (error) {
            return null;
        }
    }

    function readStoredWorkerSlug() {
        try {
            var value = sessionStorage.getItem('handyhire.selectedWorkerSlug');
            return value && String(value).trim() ? String(value).trim() : null;
        } catch (error) {
            return null;
        }
    }

    function buildIndividualBookingUrl() {
        var workerId = readStoredWorkerId();
        var workerSlug = readStoredWorkerSlug();
        var params = new URLSearchParams();

        params.set('booking_mode', 'individual');

        if (workerId) {
            params.set('worker_id', workerId);
        } else if (workerSlug) {
            params.set('worker', workerSlug);
        }

        return 'booking.html?' + params.toString();
    }

    function sanitizeBookingPage() {
        var path = String(window.location.pathname || '');
        if (!/\/booking\.html$/i.test(path)) return;

        var params;
        try {
            params = new URLSearchParams(window.location.search);
        } catch (error) {
            return;
        }

        var explicitWorker = Boolean(params.get('worker_id') || params.get('worker'));
        var explicitIndividual = params.get('booking_mode') === 'individual';

        if (!explicitWorker && !explicitIndividual) return;

        clearNonWorkerContext();

        // Individual worker selection always wins if a stale/malformed
        // package parameter somehow reaches the booking URL.
        if (params.has('package_id')) {
            params.delete('package_id');
            var query = params.toString();
            var nextUrl = 'booking.html' + (query ? '?' + query : '');
            window.history.replaceState(null, '', nextUrl);
        }
    }

    function loadTeamPackageBridge() {
        var path = String(window.location.pathname || '');
        if (!/\/booking\.html$/i.test(path)) return;

        var params;
        try {
            params = new URLSearchParams(window.location.search);
        } catch (error) {
            return;
        }

        // The bridge verifies package_type from the backend itself, so it is
        // safe to load for any package booking and stays dormant for normal
        // Multitasking Packages.
        if (!params.get('package_id')) return;
        if (params.get('booking_mode') === 'individual') return;
        if (document.getElementById('hhTeamPackageBookingBridge')) return;

        var script = document.createElement('script');
        script.id = 'hhTeamPackageBookingBridge';
        script.src = '../js/team-package-booking-fix.js';
        script.async = false;
        document.body.appendChild(script);
    }

    sanitizeBookingPage();
    loadTeamPackageBridge();

    // Capture the normal professional CTA before any older bubble-phase
    // listener can reuse stale package/team state.
    document.addEventListener('click', function (event) {
        var target = event.target;
        if (!target || typeof target.closest !== 'function') return;

        var button = target.closest('#bookNowBtn');
        if (!button) return;
        if (button.hidden || button.getAttribute('aria-hidden') === 'true') return;

        var workerId = readStoredWorkerId();
        var workerSlug = readStoredWorkerSlug();

        // If the page has not resolved a professional yet, let the
        // existing handler deal with its normal fallback/error path.
        if (!workerId && !workerSlug) return;

        clearNonWorkerContext();

        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') {
            event.stopImmediatePropagation();
        }

        window.location.href = buildIndividualBookingUrl();
    }, true);
})();
