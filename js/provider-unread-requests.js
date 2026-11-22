/* Provider unread request badge. A request is marked read when the Requests page is opened. */
(function () {
    'use strict';
    var api = window.HandyHireAPI;
    if (!api || typeof api.apiFetch !== 'function' || api.getRole() !== 'worker') return;

    var user = api.getCurrentUser() || {};
    var identity = user.id || user.email || 'worker';
    var storageKey = 'handyhire.worker.requestsSeen.' + String(identity);
    var isRequestsPage = /(?:^|\/)provider-request\.html$/.test(window.location.pathname);

    function seenState() {
        try { return JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; }
        catch (error) { return {}; }
    }

    function ensureBadges() {
        document.querySelectorAll('a[href="provider-request.html"]').forEach(function (link) {
            if (link.querySelector('[data-request-count]')) return;
            var badge = document.createElement('span');
            badge.className = 'nav-count';
            badge.setAttribute('data-request-count', '');
            badge.hidden = true;
            badge.textContent = '0';
            link.appendChild(badge);
        });
    }

    function paint(count) {
        ensureBadges();
        document.querySelectorAll('[data-request-count]').forEach(function (badge) {
            badge.textContent = count > 99 ? '99+' : String(count);
            badge.hidden = count < 1;
            badge.setAttribute('aria-label', count + ' unread requests');
        });
    }

    function snapshot(rows) {
        var current = {};
        (Array.isArray(rows) ? rows : []).forEach(function (request) {
            if (request && request.id != null) {
                current[String(request.id)] = String(request.status || 'pending').toLowerCase();
            }
        });
        return current;
    }

    function refresh() {
        api.apiFetch('/api/worker/requests')
            .then(function (response) {
                if (!response.ok) return null;
                return response.json();
            })
            .then(function (rows) {
                if (!Array.isArray(rows)) return;
                var current = snapshot(rows);
                if (isRequestsPage) {
                    localStorage.setItem(storageKey, JSON.stringify(current));
                    paint(0);
                    return;
                }
                var seen = seenState();
                var unread = Object.keys(current).filter(function (id) {
                    return !Object.prototype.hasOwnProperty.call(seen, id) || seen[id] !== current[id];
                }).length;
                paint(unread);
            })
            .catch(function () {});
    }

    ensureBadges();
    refresh();
    window.setInterval(refresh, 45000);
    window.addEventListener('focus', refresh);
})();