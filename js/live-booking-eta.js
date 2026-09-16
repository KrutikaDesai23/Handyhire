/* =========================================================
   HandyHire - Quick Hire arrival ETA
   Uses the real Quick Hire booking slot as an estimated arrival
   time. This is NOT GPS tracking; it is a live countdown to the
   booking's scheduled Quick Hire start time.
   ========================================================= */

(function () {
    'use strict';

    const REFRESH_MS = 20000;
    let refreshTimer = null;
    let lastBookingData = null;

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

    function getUserId(user) {
        if (!user) return null;
        const value = user.id != null ? user.id : user.user_id;
        return value == null ? null : String(value);
    }

    function readActiveRecord(user) {
        const userId = getUserId(user);
        if (!userId) return null;
        try {
            const raw = localStorage.getItem('handyhire.activeQuickHire.' + userId);
            if (!raw) return null;
            const record = JSON.parse(raw);
            if (!record || !record.bookingId) return null;
            if (record.ownerId != null && String(record.ownerId) !== userId) return null;
            return record;
        } catch (e) {
            return null;
        }
    }

    function parseBookingSlot(dateValue, timeValue) {
        const dateText = String(dateValue || '').trim();
        const timeText = String(timeValue || '').trim();
        const dateMatch = dateText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const timeMatch = timeText.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
        if (!dateMatch || !timeMatch) return null;

        const date = new Date(
            Number(dateMatch[1]),
            Number(dateMatch[2]) - 1,
            Number(dateMatch[3]),
            Number(timeMatch[1]),
            Number(timeMatch[2]),
            0,
            0
        );

        return Number.isNaN(date.getTime()) ? null : date;
    }

    function formatClock(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
        return date.toLocaleTimeString('en-IN', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    }

    function formatCountdown(minutes) {
        const safeMinutes = Math.max(1, Math.ceil(minutes));
        if (safeMinutes < 60) return safeMinutes + ' min';

        const hours = Math.floor(safeMinutes / 60);
        const mins = safeMinutes % 60;
        if (!mins) return hours + ' hr';
        return hours + ' hr ' + mins + ' min';
    }

    function etaIconSvg() {
        return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
            '<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8"/>' +
            '<path d="M12 7.5V12l3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
            '</svg>';
    }

    function buildEtaInfo(data) {
        const status = String(data && data.status || '').toLowerCase();
        const accepted = status === 'accepted' || status === 'confirmed';
        const inProgress = status === 'in_progress';

        if (inProgress) {
            return {
                className: 'is-arrived',
                label: 'ARRIVAL UPDATE',
                title: 'Professional has arrived',
                detail: 'Your Quick Hire service is now in progress.',
            };
        }

        if (!accepted) return null;

        const slot = parseBookingSlot(data.booking_date, data.booking_time);
        if (!slot) return null;

        const differenceMinutes = (slot.getTime() - Date.now()) / 60000;
        const clock = formatClock(slot);

        if (differenceMinutes > 1) {
            return {
                className: '',
                label: 'ESTIMATED ARRIVAL',
                title: 'Professional arriving in ~' + formatCountdown(differenceMinutes),
                detail: 'Expected around ' + clock + ' · based on your Quick Hire slot.',
            };
        }

        if (differenceMinutes >= -15) {
            return {
                className: 'is-now',
                label: 'ARRIVAL WINDOW',
                title: 'Professional expected around now',
                detail: 'Your Quick Hire slot is ' + clock + '. Check Booking Details for updates.',
            };
        }

        return {
            className: 'is-now',
            label: 'ARRIVAL WINDOW',
            title: 'Arrival window has started',
            detail: 'The scheduled Quick Hire time was ' + clock + '. Check Booking Details for the latest status.',
        };
    }

    function removeEta() {
        const eta = document.querySelector('#handyhireActiveQuickHireCard .hh-live-eta');
        if (eta) eta.remove();
    }

    function renderEta(data) {
        lastBookingData = data || null;
        const card = document.getElementById('handyhireActiveQuickHireCard');
        if (!card) return;

        const info = buildEtaInfo(data || {});
        if (!info) {
            removeEta();
            return;
        }

        let eta = card.querySelector('.hh-live-eta');
        if (!eta) {
            eta = document.createElement('div');
            const statusBlock = card.querySelector('.hh-live-status');
            if (statusBlock && statusBlock.parentNode) {
                statusBlock.insertAdjacentElement('afterend', eta);
            } else {
                const body = card.querySelector('.hh-live-body');
                if (body) body.appendChild(eta);
            }
        }

        eta.className = 'hh-live-eta' + (info.className ? ' ' + info.className : '');
        eta.innerHTML =
            '<span class="hh-live-eta-icon">' + etaIconSvg() + '</span>' +
            '<div class="hh-live-eta-copy">' +
                '<span class="hh-live-eta-label">' + info.label + '</span>' +
                '<strong>' + info.title + '</strong>' +
                '<small>' + info.detail + '</small>' +
            '</div>';
    }

    async function refreshEta() {
        const user = getCurrentUser();
        const record = readActiveRecord(user);
        const api = getApi();

        if (!user || !record || !api) {
            lastBookingData = null;
            removeEta();
            return;
        }

        const role = String(user.role || '').toLowerCase();
        const endpoint = role === 'worker'
            ? '/api/worker/bookings/sent/' + encodeURIComponent(String(record.bookingId))
            : '/api/bookings/customer/bookings/' + encodeURIComponent(String(record.bookingId));

        try {
            const response = await api.apiFetch(endpoint);
            if (!response.ok) {
                removeEta();
                return;
            }
            const data = await response.json();
            renderEta(data || {});
        } catch (e) {
            // The main tracker remains usable if ETA refresh temporarily fails.
        }
    }

    function initCardObserver() {
        if (typeof MutationObserver === 'undefined') return;
        const observer = new MutationObserver(function () {
            if (!lastBookingData) return;
            const card = document.getElementById('handyhireActiveQuickHireCard');
            if (!card) return;
            if (!card.querySelector('.hh-live-eta')) {
                renderEta(lastBookingData);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function init() {
        initCardObserver();
        window.setTimeout(refreshEta, 450);
        refreshTimer = window.setInterval(refreshEta, REFRESH_MS);

        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) refreshEta();
        });

        window.addEventListener('beforeunload', function () {
            if (refreshTimer) window.clearInterval(refreshTimer);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
