/* =========================================================
   HandyHire - Quick Hire live integration
   Keeps the shared Quick Hire flow authenticated, persists the
   created booking for Home tracking, and surfaces safer API errors.
   ========================================================= */

(function () {
    'use strict';

    var api = window.HandyHireAPI;
    if (!api || typeof api.apiFetch !== 'function') return;

    function getUser() {
        try {
            return typeof api.getCurrentUser === 'function' ? api.getCurrentUser() : null;
        } catch (e) {
            return null;
        }
    }

    function getUserId(user) {
        if (!user) return null;
        var value = user.id != null ? user.id : user.user_id;
        return value == null ? null : String(value);
    }

    function rememberReturnPage() {
        try {
            sessionStorage.setItem('handyhire.auth.returnTo', 'quick-hire.html');
        } catch (e) {}
    }

    function redirectToLogin() {
        rememberReturnPage();
        window.location.href = 'login.html';
    }

    var currentUser = getUser();
    var currentRole = currentUser && currentUser.role ? String(currentUser.role) : '';
    var hasSession = typeof api.isLoggedIn === 'function' ? api.isLoggedIn() : true;

    if (!hasSession || !currentUser || (currentRole !== 'customer' && currentRole !== 'worker')) {
        redirectToLogin();
        return;
    }

    function parseRequestBody(options) {
        try {
            if (!options || typeof options.body !== 'string') return {};
            var parsed = JSON.parse(options.body);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (e) {
            return {};
        }
    }

    function persistQuickHire(booking, payload) {
        if (!booking || !booking.id) return;

        var user = getUser() || currentUser;
        var ownerId = getUserId(user);
        if (!ownerId) return;

        var record = {
            bookingId: booking.id,
            ownerId: ownerId,
            ownerRole: user && user.role ? user.role : currentRole,
            workerId: booking.worker_id != null ? booking.worker_id : payload.worker_id,
            workerName: booking.worker_name || 'Professional',
            serviceId: booking.service_id != null ? booking.service_id : payload.service_id,
            serviceName: booking.service_name || 'Quick Hire service',
            booking_date: booking.booking_date || payload.booking_date,
            booking_time: booking.booking_time || payload.booking_time,
            address: booking.address || payload.address || '',
            amount: booking.amount != null ? booking.amount : payload.amount,
            hours: payload.hours || 1,
            createdAt: new Date().toISOString()
        };

        try {
            localStorage.setItem('handyhire.activeQuickHire.' + ownerId, JSON.stringify(record));
            localStorage.setItem('handyhire.activeQuickHire.latest', JSON.stringify(record));
        } catch (e) {}

        try {
            sessionStorage.setItem('handyhire.lastBooking', JSON.stringify({
                bookingId: record.bookingId,
                id: record.bookingId,
                workerId: record.workerId,
                workerName: record.workerName,
                booking_date: record.booking_date,
                booking_time: record.booking_time,
                address: record.address,
                amount: record.amount,
                total: record.amount,
                hours: record.hours,
                serviceName: record.serviceName,
                bookingType: 'quick-hire'
            }));
        } catch (e) {}
    }

    function extractDetail(data) {
        if (!data) return '';
        if (typeof data.detail === 'string') return data.detail;
        if (Array.isArray(data.detail)) {
            return data.detail.map(function (item) {
                if (!item) return '';
                if (typeof item === 'string') return item;
                return item.msg || item.message || '';
            }).filter(Boolean).join(' ');
        }
        return '';
    }

    function showSubmitError(status, detail) {
        var message = '';
        if (status === 400) {
            message = detail || 'This Quick Hire request could not be created. Please review the selected professional.';
        } else if (status === 403) {
            message = 'This account is not allowed to create this booking.';
        } else if (status === 404) {
            message = detail || 'The selected professional or service is no longer available.';
        } else if (status === 422) {
            message = 'Please check the booking details and try again.';
            if (detail) message += ' ' + detail;
        } else if (status >= 500) {
            message = 'HandyHire could not create the booking right now. Please try again.';
        }

        if (!message) return;

        window.setTimeout(function () {
            var el = document.getElementById('quickHireConfirmMessage');
            if (!el) return;
            el.textContent = message;
            el.hidden = false;
        }, 0);
    }

    var originalApiFetch = api.apiFetch.bind(api);

    api.apiFetch = function (path, options) {
        options = options || {};
        var method = String(options.method || 'GET').toUpperCase();
        var isQuickHireCreate = path === '/api/bookings' && method === 'POST';
        var payload = isQuickHireCreate ? parseRequestBody(options) : {};

        return originalApiFetch(path, options).then(function (response) {
            if (!isQuickHireCreate) return response;

            if (response && response.status === 401) {
                window.setTimeout(redirectToLogin, 0);
                return response;
            }

            if (response && response.ok && typeof response.clone === 'function') {
                return response.clone().json().then(function (booking) {
                    persistQuickHire(booking, payload);
                    return response;
                }).catch(function () {
                    return response;
                });
            }

            if (response && !response.ok && typeof response.clone === 'function') {
                response.clone().json().then(function (data) {
                    showSubmitError(response.status, extractDetail(data));
                }).catch(function () {
                    showSubmitError(response.status, '');
                });
            }

            return response;
        });
    };
})();
