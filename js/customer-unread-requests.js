/* Customer unread booking-request badge (WhatsApp-style). */
(function () {
    'use strict';
    var api = window.HandyHireAPI;
    if (!api || typeof api.apiFetch !== 'function' || api.getRole() !== 'customer') return;

    var user = api.getCurrentUser() || {};
    var identity = user.id || user.email || 'customer';
    var storageKey = 'handyhire.customer.requestsSeen.' + String(identity);
    var isRequestsView = /(?:^|\/)activity\.html$/.test(window.location.pathname) &&
        new URLSearchParams(window.location.search).get('view') === 'requests';

    function readSeen() {
        try { return JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; }
        catch (error) { return {}; }
    }

    function paint(count) {
        document.querySelectorAll('[data-customer-request-count]').forEach(function (badge) {
            badge.textContent = count > 99 ? '99+' : String(count);
            badge.hidden = count < 1;
            badge.setAttribute('aria-label', count + ' unread requests');
        });
    }

    function markViewed(rows) {
        var snapshot = {};
        (Array.isArray(rows) ? rows : []).forEach(function (booking) {
            if (booking && booking.id != null) {
                snapshot[String(booking.id)] = String(booking.status || 'pending').toLowerCase();
            }
        });
        try { localStorage.setItem(storageKey, JSON.stringify(snapshot)); } catch (error) {}
        paint(0);
    }

    window.HandyHireUnreadRequests = { markViewed: markViewed };

    function refresh() {
        api.apiFetch('/api/bookings/customer/bookings')
            .then(function (response) {
                if (!response.ok) return null;
                return response.json();
            })
            .then(function (rows) {
                if (!Array.isArray(rows)) return;
                var current = {};
                rows.forEach(function (booking) {
                    if (booking && booking.id != null) {
                        current[String(booking.id)] = String(booking.status || 'pending').toLowerCase();
                    }
                });

                if (isRequestsView) {
                    localStorage.setItem(storageKey, JSON.stringify(current));
                    paint(0);
                    return;
                }

                var seen = readSeen();
                var unread = Object.keys(current).filter(function (id) {
                    return !Object.prototype.hasOwnProperty.call(seen, id) || seen[id] !== current[id];
                }).length;
                paint(unread);
            })
            .catch(function () {
                // Keep the last rendered count if the network is temporarily unavailable.
            });
    }

    refresh();
    window.setInterval(refresh, 45000);
    window.addEventListener('focus', refresh);
})();