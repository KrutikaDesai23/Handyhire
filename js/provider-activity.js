/* =========================================================
   HandyHire - Activity / Booking History JavaScript
   Fetches the authenticated provider's real bookings from
   the FastAPI backend (GET /api/worker/bookings) and renders
   them grouped by Today / Yesterday / Earlier.
   Providers can update booking status via the backend.
   ========================================================= */

(function () {
    'use strict';

    const SECTION_TITLES = {
        today:     'Today',
        yesterday: 'Yesterday',
        older:     'Earlier',
    };

    const STATUS_MAP = {
        pending:   { label: 'Pending',   css: 'booking-status--pending' },
        accepted:  { label: 'Accepted',  css: 'booking-status--confirmed' },
        confirmed: { label: 'Confirmed', css: 'booking-status--confirmed' },
        rejected:  { label: 'Rejected',  css: 'booking-status--cancelled' },
        declined:  { label: 'Declined',  css: 'booking-status--cancelled' },
        cancelled: { label: 'Cancelled', css: 'booking-status--cancelled' },
        completed: { label: 'Completed', css: 'booking-status--completed' },
    };

    const STATUS_ACTIONS = {
        pending: [
            { key: 'accept', label: 'Accept', newStatus: 'accepted', css: 'booking-action-btn--accept' },
            { key: 'reject', label: 'Reject', newStatus: 'rejected', css: 'booking-action-btn--reject' },
        ],
        accepted: [
            { key: 'complete', label: 'Complete', newStatus: 'completed', css: 'booking-action-btn--complete' },
            { key: 'cancel',   label: 'Cancel',   newStatus: 'cancelled', css: 'booking-action-btn--cancel' },
        ],
    };

    let loadedBookings = [];

    function getApi() {
        if (window.HandyHireAPI && typeof window.HandyHireAPI.apiFetch === 'function') {
            return window.HandyHireAPI;
        }
        return null;
    }

    function hasSession() {
        try {
            const token = localStorage.getItem('handyhire.auth.token');
            return Boolean(token && token.trim());
        } catch (e) {
            return false;
        }
    }

    function redirectToLogin() {
        try {
            sessionStorage.setItem('handyhire.provider.previousPage', 'provider-activity.html');
        } catch (e) {}
        window.location.href = 'login.html';
    }

    function buildStars(rating) {
        const full = Math.max(0, Math.min(5, Math.floor(Number(rating) || 0)));
        const empty = 5 - full;
        return '\u2605'.repeat(full) + '\u2606'.repeat(empty);
    }

    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function parseDate(value) {
        if (!value) return null;
        const text = String(value).trim();
        const parts = text.split('-').map(Number);
        if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
            return new Date(parts[0], parts[1] - 1, parts[2]);
        }
        const d = new Date(text);
        return isNaN(d.getTime()) ? null : d;
    }

    function isSameDay(a, b) {
        return a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate();
    }

    function groupFor(date) {
        if (!date) return 'older';
        const now = new Date();
        if (isSameDay(date, now)) return 'today';
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        if (isSameDay(date, yesterday)) return 'yesterday';
        return 'older';
    }

    function formatDate(date) {
        if (!date) return '--';
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const dayNum = date.getDate();
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        const now = new Date();
        if (isSameDay(date, now)) return 'Today, ' + dayNum + ' ' + month;
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        if (isSameDay(date, yesterday)) return 'Yesterday, ' + dayNum + ' ' + month;
        return dayNum + ' ' + month + ' ' + year;
    }

    function formatTime(time) {
        const text = String(time || '').trim();
        if (!text) return '--';
        const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
        if (match) {
            let hour = parseInt(match[1], 10);
            const minute = match[2];
            const suffix = hour >= 12 ? 'PM' : 'AM';
            hour = hour % 12 || 12;
            return hour + ':' + minute + ' ' + suffix;
        }
        return text;
    }

    function formatPrice(amount) {
        const n = Number(amount);
        if (!Number.isFinite(n) || n <= 0) return '--';
        return '\u20B9' + n.toLocaleString('en-IN');
    }

    function statusClass(status) {
        const key = String(status || 'pending').toLowerCase();
        const mapped = STATUS_MAP[key];
        if (mapped) return 'booking-status ' + mapped.css;
        return 'booking-status booking-status--pending';
    }

    function mapBooking(b) {
        const statusKey = String(b.status || 'pending').toLowerCase();
        const status = STATUS_MAP[statusKey] || { label: escapeHtml(b.status || '--'), css: 'booking-status--pending' };
        const date = parseDate(b.booking_date);

        return {
            id: b.id,
            name: b.customer_name || '--',
            occupation: b.service_name || '--',
            status: status.label,
            statusCss: status.css,
            date: formatDate(date),
            time: formatTime(b.booking_time),
            group: groupFor(date),
            amount: typeof b.amount === 'number' ? b.amount : null,
            address: b.address || '--',
        };
    }

    function renderActions(booking) {
        const key = String(booking.status || '').toLowerCase();
        const actions = STATUS_ACTIONS[key];
        if (!actions || !actions.length) return '';

        const buttons = actions.map(function (a) {
            return "<button type='button' class='booking-action-btn " + escapeHtml(a.css) + "' data-action='" + escapeHtml(a.key) + "' data-id='" + escapeHtml(booking.id) + "'>" + escapeHtml(a.label) + "</button>";
        }).join('');

        return "<div class='booking-actions'>" + buttons + "</div>";
    }

    function renderCard(b) {
        const ratingRow = (b.rating != null)
            ? "<div class='booking-rating' aria-label='Rated " + Number(b.rating).toFixed(1) + " out of 5'>" +
                    "<span class='stars' aria-hidden='true'>" + buildStars(b.rating) + "</span>" +
                    "<span class='rating-value'>" + Number(b.rating).toFixed(1) + "</span>" +
              "</div>"
            : '';

        const amountRow = (b.amount != null)
            ? "<div class='booking-meta'>" +
                    "<span><span class='meta-label'>Amount:</span><span class='meta-value'>" + escapeHtml(formatPrice(b.amount)) + "</span></span>" +
              "</div>"
            : '';

        return `
            <article class="booking-card" tabindex="0"
                     data-booking-id="${escapeHtml(b.id)}"
                     aria-label="Booking ${escapeHtml(b.id)} with ${escapeHtml(b.name)}, ${escapeHtml(b.occupation)}, ${escapeHtml(b.status)} on ${escapeHtml(b.date)} at ${escapeHtml(b.time)}">
                <div class="booking-top">
                    <div>
                        <p class="booking-name">${escapeHtml(b.name)}</p>
                        <p class="booking-occupation">${escapeHtml(b.occupation)}</p>
                    </div>
                    <span class="${b.statusCss}">${escapeHtml(b.status)}</span>
                </div>
                ${ratingRow}
                <div class="booking-meta">
                    <span><span class="meta-label">Date:</span><span class="meta-value">${escapeHtml(b.date)}</span></span>
                    <span><span class="meta-label">Time:</span><span class="meta-value">${escapeHtml(b.time)}</span></span>
                </div>
                ${amountRow}
                ${renderActions({
                    id: b.id,
                    status: b.status,
                })}
            </article>
        `.trim();
    }

    function renderSection(groupKey, items) {
        if (!items.length) return '';
        const title = SECTION_TITLES[groupKey] || '';
        const idSafe = groupKey.replace(/[^a-z0-9]/gi, '-');
        const cards = items.map(renderCard).join('');
        return `
            <section class="section-group" aria-labelledby="group-${idSafe}">
                <h2 class="section-title" id="group-${idSafe}">${title}</h2>
                ${cards}
            </section>
        `.trim();
    }

    function renderFeed(bookings, container, emptyState) {
        const groups = { today: [], yesterday: [], older: [] };
        bookings.forEach(function (b) {
            if (groups[b.group]) groups[b.group].push(b);
        });

        const html = ['today', 'yesterday', 'older']
            .map(function (key) { return renderSection(key, groups[key]); })
            .filter(Boolean)
            .join('');

        container.innerHTML = html;
        if (emptyState) emptyState.hidden = Boolean(html);
    }

    function filterBookings(bookings, query) {
        const q = String(query || '').trim().toLowerCase();
        if (!q) return bookings.slice();

        return bookings.filter(function (b) {
            return (
                b.name.toLowerCase().includes(q) ||
                b.occupation.toLowerCase().includes(q) ||
                b.status.toLowerCase().includes(q) ||
                b.date.toLowerCase().includes(q) ||
                b.time.toLowerCase().includes(q) ||
                b.address.toLowerCase().includes(q) ||
                (b.amount != null && String(b.amount).includes(q))
            );
        });
    }

    function initSearch(container, emptyState) {
        const input = document.getElementById('activitySearch');
        if (!input) return;

        input.addEventListener('input', function () {
            const filtered = filterBookings(loadedBookings, input.value);
            renderFeed(filtered, container, emptyState);
            if (emptyState && !filtered.length && loadedBookings.length) {
                emptyState.textContent = 'No bookings match your search.';
                emptyState.hidden = false;
            }
        });
    }

    function renderLoading(container, emptyState) {
        container.innerHTML = '';
        if (emptyState) {
            emptyState.textContent = 'Loading your bookings...';
            emptyState.hidden = false;
        }
    }

    function renderError(container, emptyState, message) {
        container.innerHTML = '';
        if (emptyState) {
            emptyState.textContent = message;
            emptyState.hidden = false;
        }
    }

    function renderEmpty(emptyState) {
        if (emptyState) {
            emptyState.textContent = 'No bookings yet. When a customer books you, your bookings will appear here.';
            emptyState.hidden = false;
        }
    }

    function loadBookings(container, emptyState) {
        const api = getApi();
        if (!api) {
            renderError(container, emptyState, 'Booking service is unavailable right now. Please try again later.');
            return;
        }

        renderLoading(container, emptyState);

        api.apiFetch('/api/worker/bookings')
            .then(function (response) {
                if (response.status === 401) {
                    redirectToLogin();
                    return null;
                }
                if (response.status === 403) {
                    renderError(container, emptyState, 'You are not allowed to view these bookings.');
                    return null;
                }
                if (!response.ok) {
                    renderError(container, emptyState, 'Unable to load your bookings. Please try again.');
                    return null;
                }
                return response.json();
            })
            .then(function (data) {
                if (!data) return;

                loadedBookings = (Array.isArray(data) ? data : []).map(mapBooking);
                if (!loadedBookings.length) {
                    container.innerHTML = '';
                    renderEmpty(emptyState);
                    return;
                }

                renderFeed(loadedBookings, container, emptyState);
                initSearch(container, emptyState);
            })
            .catch(function () {
                renderError(container, emptyState, 'Unable to connect to HandyHire. Please try again.');
            });
    }

    function submitStatusUpdate(bookingId, newStatus) {
        const api = getApi();
        if (!api) return;

        const container = document.getElementById('activityFeed');
        const emptyState = document.getElementById('emptyState');
        const endpoint = '/api/worker/bookings/' + encodeURIComponent(String(bookingId)) + '/status?new_status=' + encodeURIComponent(newStatus);

        api.apiFetch(endpoint, { method: 'PUT' })
            .then(function (response) {
                if (response.status === 401) {
                    redirectToLogin();
                    return null;
                }
                if (response.status === 403) {
                    renderError(container, emptyState, 'You are not allowed to update this booking.');
                    return null;
                }
                if (response.status === 404) {
                    renderError(container, emptyState, 'This booking could not be found.');
                    return null;
                }
                if (response.status === 400) {
                    renderError(container, emptyState, 'This booking can no longer be updated in its current state.');
                    return null;
                }
                if (!response.ok) {
                    renderError(container, emptyState, 'Unable to update this booking. Please try again.');
                    return null;
                }
                return response.json();
            })
            .then(function (updated) {
                if (!updated) return;
                const idx = loadedBookings.findIndex(function (b) { return String(b.id) === String(updated.id); });
                if (idx >= 0) {
                    loadedBookings[idx] = mapBooking(updated);
                }
                renderFeed(loadedBookings, container, emptyState);
                initSearch(container, emptyState);
            })
            .catch(function () {
                renderError(container, emptyState, 'Unable to connect to HandyHire. Please try again.');
            });
    }

    function initActions() {
        const panelEl = document.getElementById('activityFeed');
        if (!panelEl) return;

        panelEl.addEventListener('click', function (event) {
            const btn = event.target.closest('[data-action]');
            if (!btn || !panelEl.contains(btn)) return;

            const action = btn.dataset.action;
            const id = btn.dataset.id;
            if (!action || !id) return;

            const newStatusMap = {
                accept: 'accepted',
                reject: 'rejected',
                complete: 'completed',
                cancel: 'cancelled',
            };
            const newStatus = newStatusMap[action];
            if (!newStatus) return;

            btn.disabled = true;
            btn.textContent = btn.textContent.replace(/\.\.\.$/, '') + '...';

            submitStatusUpdate(id, newStatus);
        });
    }

    function init() {
        const feed = document.getElementById('activityFeed');
        const emptyState = document.getElementById('emptyState');
        if (!feed) return;

        if (!(window.HandyHireAPI && window.HandyHireAPI.requireRole('worker'))) return;

        initActions();
        loadBookings(feed, emptyState);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
