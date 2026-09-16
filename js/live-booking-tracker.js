/* =========================================================
   HandyHire - Live booking / request tracker
   Customer: tracks the active Quick Hire on Home.
   Provider: shows active Quick Hire created as a buyer and
             the newest pending incoming request.
   Backend remains the source of truth for status.
   ========================================================= */

(function () {
    'use strict';

    const POLL_MS = 20000;
    const TERMINAL = new Set(['completed', 'rejected', 'cancelled']);
    let pollTimer = null;

    function getApi() {
        return (window.HandyHireAPI && typeof window.HandyHireAPI.apiFetch === 'function')
            ? window.HandyHireAPI
            : null;
    }

    function getCurrentUser() {
        try {
            if (window.HandyHireAPI && typeof window.HandyHireAPI.getCurrentUser === 'function') {
                return window.HandyHireAPI.getCurrentUser();
            }
        } catch (e) {}
        return null;
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getUserId(user) {
        if (!user) return null;
        const value = user.id != null ? user.id : user.user_id;
        return value == null ? null : String(value);
    }

    function activeQuickHireKey(userId) {
        return 'handyhire.activeQuickHire.' + String(userId || '');
    }

    function readJsonStorage(storage, key) {
        try {
            const raw = storage.getItem(key);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (e) {
            return null;
        }
    }

    function readActiveQuickHire(user) {
        const userId = getUserId(user);
        if (!userId) return null;
        const record = readJsonStorage(localStorage, activeQuickHireKey(userId));
        if (!record || !record.bookingId) return null;
        if (record.ownerId != null && String(record.ownerId) !== userId) return null;
        return record;
    }

    function readLatestQuickHire() {
        return readJsonStorage(localStorage, 'handyhire.activeQuickHire.latest');
    }

    function clearActiveQuickHire(user, bookingId) {
        const userId = getUserId(user);
        if (!userId) return;
        try {
            const record = readJsonStorage(localStorage, activeQuickHireKey(userId));
            if (!record || String(record.bookingId) === String(bookingId)) {
                localStorage.removeItem(activeQuickHireKey(userId));
            }
        } catch (e) {}
    }

    function getStack() {
        let stack = document.getElementById('handyhireLiveStack');
        if (stack) return stack;
        stack = document.createElement('div');
        stack.id = 'handyhireLiveStack';
        stack.className = 'hh-live-stack';
        stack.setAttribute('aria-live', 'polite');
        document.body.appendChild(stack);
        return stack;
    }

    function removeCard(id) {
        const card = document.getElementById(id);
        if (card) card.remove();
    }

    function upsertCard(id, className, html) {
        const stack = getStack();
        let card = document.getElementById(id);
        if (!card) {
            card = document.createElement('section');
            card.id = id;
            stack.appendChild(card);
        }
        card.className = 'hh-live-card ' + (className || '');
        card.innerHTML = html;
        return card;
    }

    function formatCurrency(amount) {
        const number = Number(amount);
        return Number.isFinite(number) ? '₹' + number.toLocaleString('en-IN') : '--';
    }

    function formatDate(value) {
        if (!value) return '--';
        const date = new Date(String(value) + 'T00:00:00');
        if (isNaN(date.getTime())) return String(value);
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }

    function formatTime(value) {
        const text = String(value || '').trim();
        const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
        if (!match) return text || '--';
        let hour = Number(match[1]);
        const suffix = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12 || 12;
        return hour + ':' + match[2] + ' ' + suffix;
    }

    function statusInfo(rawStatus) {
        const status = String(rawStatus || 'pending').toLowerCase();
        const map = {
            pending: {
                title: 'Waiting for professional',
                detail: 'Your Quick Hire request has been sent.',
                step: 0,
            },
            accepted: {
                title: 'Professional confirmed',
                detail: 'Your request has been accepted.',
                step: 1,
            },
            confirmed: {
                title: 'Professional confirmed',
                detail: 'Your request has been accepted.',
                step: 1,
            },
            in_progress: {
                title: 'Work in progress',
                detail: 'Your service is currently underway.',
                step: 2,
            },
            completion_requested: {
                title: 'Completion requested',
                detail: 'Review the work and confirm completion.',
                step: 3,
            },
            completed: {
                title: 'Quick Hire completed',
                detail: 'The booking has been completed.',
                step: 3,
            },
            rejected: {
                title: 'Request declined',
                detail: 'This professional could not take the request.',
                step: 0,
            },
            cancelled: {
                title: 'Booking cancelled',
                detail: 'This Quick Hire is no longer active.',
                step: 0,
            },
        };
        return map[status] || {
            title: 'Booking updated',
            detail: 'Open Booking Details for the latest status.',
            step: 1,
        };
    }

    function progressHtml(step, terminal) {
        let html = '';
        for (let i = 0; i < 4; i += 1) {
            let cls = '';
            if (!terminal && i < step) cls = ' class="is-done"';
            if (!terminal && i === step) cls = ' class="is-active"';
            html += '<span' + cls + '></span>';
        }
        return html;
    }

    function statusIconSvg() {
        return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
            '<path d="M4 12h4l2.1-5 3.6 10 2.1-5H20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
            '</svg>';
    }

    function arrowSvg() {
        return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }

    function shouldHideOwnStatus(bookingId, status) {
        try {
            return sessionStorage.getItem('handyhire.quickHireTracker.dismissed.' + bookingId) === status;
        } catch (e) {
            return false;
        }
    }

    function dismissOwnStatus(bookingId, status) {
        try {
            sessionStorage.setItem('handyhire.quickHireTracker.dismissed.' + bookingId, status);
        } catch (e) {}
        removeCard('handyhireActiveQuickHireCard');
    }

    function renderOwnQuickHire(user, data, record) {
        const bookingId = data.id || record.bookingId;
        const status = String(data.status || 'pending').toLowerCase();
        const terminal = TERMINAL.has(status);

        if (shouldHideOwnStatus(bookingId, status)) {
            removeCard('handyhireActiveQuickHireCard');
            if (terminal) clearActiveQuickHire(user, bookingId);
            return;
        }

        const info = statusInfo(status);
        const workerName = data.worker_name || record.workerName || 'Professional';
        const serviceName = data.service_name || data.package_name || record.serviceName || 'Quick Hire service';
        const userRole = String(user.role || '').toLowerCase();
        const detailsHref = userRole === 'worker'
            ? 'provider-booking-details.html?booking_id=' + encodeURIComponent(String(bookingId)) + '&mode=sent'
            : 'booking-details.html?booking_id=' + encodeURIComponent(String(bookingId));

        const schedule = formatDate(data.booking_date) + ' · ' + formatTime(data.booking_time);
        const amount = formatCurrency(data.amount);
        const terminalClass = terminal ? 'is-terminal' : '';

        const card = upsertCard(
            'handyhireActiveQuickHireCard',
            terminalClass,
            '<div class="hh-live-head">' +
                '<span class="hh-live-kicker"><span class="hh-live-kicker-dot"></span>ACTIVE QUICK HIRE</span>' +
                '<button type="button" class="hh-live-close" aria-label="Dismiss this update">×</button>' +
            '</div>' +
            '<div class="hh-live-body">' +
                '<h2 class="hh-live-title">' + escapeHtml(workerName) + '</h2>' +
                '<p class="hh-live-subtitle">' + escapeHtml(serviceName) + '</p>' +
                '<div class="hh-live-status">' +
                    '<span class="hh-live-status-icon">' + statusIconSvg() + '</span>' +
                    '<div class="hh-live-status-copy"><strong>' + escapeHtml(info.title) + '</strong><span>' + escapeHtml(info.detail) + '</span></div>' +
                '</div>' +
                '<div class="hh-live-meta">' +
                    '<div class="hh-live-meta-item"><span>Schedule</span><strong>' + escapeHtml(schedule) + '</strong></div>' +
                    '<div class="hh-live-meta-item"><span>Estimated total</span><strong>' + escapeHtml(amount) + '</strong></div>' +
                '</div>' +
                '<div class="hh-live-progress" aria-label="Quick Hire progress">' + progressHtml(info.step, terminal) + '</div>' +
                '<div class="hh-live-actions">' +
                    '<a class="hh-live-btn" href="' + detailsHref + '">View booking ' + arrowSvg() + '</a>' +
                    '<span class="hh-live-chip">Booking #' + escapeHtml(bookingId) + '</span>' +
                '</div>' +
            '</div>'
        );

        const close = card.querySelector('.hh-live-close');
        if (close) {
            close.addEventListener('click', function () {
                dismissOwnStatus(bookingId, status);
            });
        }

        if (terminal) {
            clearActiveQuickHire(user, bookingId);
        }
    }

    async function refreshOwnQuickHire(user) {
        const record = readActiveQuickHire(user);
        if (!record) {
            removeCard('handyhireActiveQuickHireCard');
            return;
        }

        const api = getApi();
        if (!api) return;

        const userRole = String(user.role || '').toLowerCase();
        const endpoint = userRole === 'worker'
            ? '/api/worker/bookings/sent/' + encodeURIComponent(String(record.bookingId))
            : '/api/bookings/customer/bookings/' + encodeURIComponent(String(record.bookingId));

        try {
            const response = await api.apiFetch(endpoint);
            if (response.status === 401) return;
            if (response.status === 403 || response.status === 404) {
                clearActiveQuickHire(user, record.bookingId);
                removeCard('handyhireActiveQuickHireCard');
                return;
            }
            if (!response.ok) return;
            const data = await response.json();
            renderOwnQuickHire(user, data || {}, record);
        } catch (e) {
            // Keep Home usable when status refresh is temporarily unavailable.
        }
    }

    function getIncomingDismissedKey(user) {
        return 'handyhire.providerRequestTracker.dismissed.' + String(getUserId(user) || '');
    }

    function isIncomingDismissed(user, requestId) {
        try {
            return sessionStorage.getItem(getIncomingDismissedKey(user)) === String(requestId);
        } catch (e) {
            return false;
        }
    }

    function dismissIncoming(user, requestId) {
        try {
            sessionStorage.setItem(getIncomingDismissedKey(user), String(requestId));
        } catch (e) {}
        removeCard('handyhireIncomingRequestCard');
    }

    function renderIncomingRequest(user, request) {
        if (!request || !request.id) {
            removeCard('handyhireIncomingRequestCard');
            return;
        }
        if (isIncomingDismissed(user, request.id)) {
            removeCard('handyhireIncomingRequestCard');
            return;
        }

        const latestQuickHire = readLatestQuickHire();
        const isQuickHire = latestQuickHire && String(latestQuickHire.bookingId) === String(request.booking_id);
        const customer = request.customer_name || 'Customer';
        const service = request.package_name || request.service_name || 'Service request';
        const schedule = formatDate(request.booking_date) + ' · ' + formatTime(request.booking_time);
        const amount = formatCurrency(request.amount);
        const kicker = isQuickHire ? 'QUICK HIRE REQUEST' : 'NEW BOOKING REQUEST';
        const title = isQuickHire ? 'Someone needs help now' : 'You have a new request';

        const card = upsertCard(
            'handyhireIncomingRequestCard',
            'hh-live-card--incoming',
            '<div class="hh-live-head">' +
                '<span class="hh-live-kicker"><span class="hh-live-kicker-dot"></span>' + escapeHtml(kicker) + '</span>' +
                '<button type="button" class="hh-live-close" aria-label="Dismiss this request alert">×</button>' +
            '</div>' +
            '<div class="hh-live-body">' +
                '<h2 class="hh-live-title">' + escapeHtml(title) + '</h2>' +
                '<p class="hh-live-subtitle">' + escapeHtml(customer) + ' · ' + escapeHtml(service) + '</p>' +
                '<div class="hh-live-meta">' +
                    '<div class="hh-live-meta-item"><span>Requested for</span><strong>' + escapeHtml(schedule) + '</strong></div>' +
                    '<div class="hh-live-meta-item"><span>Estimated value</span><strong>' + escapeHtml(amount) + '</strong></div>' +
                '</div>' +
                '<div class="hh-live-actions">' +
                    '<a class="hh-live-btn" href="provider-request.html">View request ' + arrowSvg() + '</a>' +
                    '<span class="hh-live-chip">Awaiting response</span>' +
                '</div>' +
            '</div>'
        );

        const close = card.querySelector('.hh-live-close');
        if (close) {
            close.addEventListener('click', function () {
                dismissIncoming(user, request.id);
            });
        }
    }

    async function refreshProviderIncoming(user) {
        if (String(user.role || '').toLowerCase() !== 'worker') {
            removeCard('handyhireIncomingRequestCard');
            return;
        }

        const api = getApi();
        if (!api) return;

        try {
            const response = await api.apiFetch('/api/worker/requests');
            if (!response.ok) return;
            const data = await response.json();
            const pending = (Array.isArray(data) ? data : [])
                .filter(function (request) {
                    return String(request.status || 'pending').toLowerCase() === 'pending';
                })
                .sort(function (a, b) {
                    return Number(b.id || b.booking_id || 0) - Number(a.id || a.booking_id || 0);
                });

            if (!pending.length) {
                removeCard('handyhireIncomingRequestCard');
                return;
            }

            renderIncomingRequest(user, pending[0]);
        } catch (e) {
            // Do not block provider Home if request refresh fails.
        }
    }

    async function refreshAll() {
        const user = getCurrentUser();
        if (!user) return;
        await refreshOwnQuickHire(user);
        await refreshProviderIncoming(user);
    }

    function init() {
        const user = getCurrentUser();
        if (!user) return;

        refreshAll();
        pollTimer = window.setInterval(refreshAll, POLL_MS);

        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) refreshAll();
        });

        window.addEventListener('beforeunload', function () {
            if (pollTimer) window.clearInterval(pollTimer);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
