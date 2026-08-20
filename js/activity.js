/* =========================================================
   HandyHire - Activity / Booking History JavaScript
   Fetches the authenticated customer's real bookings from
   the FastAPI backend (GET /api/bookings/customer/bookings)
   and renders them grouped by Today / Yesterday / Earlier.
   The PostgreSQL database is the source of truth.
   ========================================================= */

(function () {
    'use strict';

    /**
     * Title shown above each section's cards.
     */
    const SECTION_TITLES = {
        today:     'Today',
        yesterday: 'Yesterday',
        older:     'Earlier',
    };

    /**
     * Map a backend status onto the existing status pill
     * CSS classes so no new visual system is introduced.
     */
    const STATUS_MAP = {
        pending:   { label: 'Pending',   css: 'booking-status--pending' },
        accepted:  { label: 'Accepted',  css: 'booking-status--confirmed' },
        confirmed: { label: 'Confirmed', css: 'booking-status--confirmed' },
        rejected:  { label: 'Rejected',  css: 'booking-status--cancelled' },
        cancelled: { label: 'Cancelled', css: 'booking-status--cancelled' },
        completed: { label: 'Completed', css: 'booking-status--completed' },
    };

    /**
     * Build a "★ ★ ★ ★ ★" style stars string for a rating.
     * @param {number} rating
     * @returns {string}
     */
    function buildStars(rating) {
        const full = Math.max(0, Math.min(5, Math.floor(rating)));
        const empty = 5 - full;
        return '\u2605'.repeat(full) + '\u2606'.repeat(empty);
    }

    /**
     * Escape user-supplied text before injecting as HTML.
     * @param {string} str
     * @returns {string}
     */
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Resolve the API helper (js/api.js) with a safe fallback.
     * @returns {Object|null}
     */
    function getApi() {
        if (window.HandyHireAPI && typeof window.HandyHireAPI.apiFetch === 'function') {
            return window.HandyHireAPI;
        }
        return null;
    }

    /**
     * True when a customer auth token is present.
     * @returns {boolean}
     */
    function hasSession() {
        try {
            const token = localStorage.getItem('handyhire.auth.token');
            return Boolean(token && token.trim());
        } catch (e) {
            return false;
        }
    }

    /**
     * Redirect an unauthenticated/session-expired customer to
     * the login page, remembering where to return afterwards.
     */
    function redirectToLogin() {
        try {
            sessionStorage.setItem('handyhire.customer.previousPage', 'activity.html');
        } catch (e) {
            // Ignore storage errors.
        }
        window.location.href = 'login.html';
    }

    /**
     * Normalize "2026-08-19" or a Date into a Date object for
     * Today/Yesterday comparisons. Returns null on bad input.
     * @param {string|Date} value
     * @returns {Date|null}
     */
    function parseDate(value) {
        if (value instanceof Date) return value;
        const text = String(value || '').trim();
        if (!text) return null;
        const parts = text.split('-').map(Number);
        if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
            return new Date(parts[0], parts[1] - 1, parts[2]);
        }
        const d = new Date(text);
        return isNaN(d.getTime()) ? null : d;
    }

    /**
     * True when two dates are on the same calendar day.
     * @param {Date} a
     * @param {Date} b
     * @returns {boolean}
     */
    function isSameDay(a, b) {
        return a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate();
    }

    /**
     * Derive the feed group for a booking date:
     * 'today' | 'yesterday' | 'older'.
     * @param {Date|null} date
     * @returns {string}
     */
    function groupFor(date) {
        if (!date) return 'older';
        const now = new Date();
        if (isSameDay(date, now)) return 'today';
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        if (isSameDay(date, yesterday)) return 'yesterday';
        return 'older';
    }

    /**
     * Format a date for card display.
     * @param {Date|null} date
     * @returns {string}
     */
    function formatDate(date) {
        if (!date) return '--';
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const group = groupFor(date);
        const dayNum = date.getDate();
        const month = months[date.getMonth()];
        if (group === 'today') return 'Today, ' + dayNum + ' ' + month;
        if (group === 'yesterday') return 'Yesterday, ' + dayNum + ' ' + month;
        return dayNum + ' ' + month + ' ' + date.getFullYear();
    }

    /**
     * Normalize a stored booking time ("10:00" / "14:30") for
     * display.
     * @param {string} time
     * @returns {string}
     */
    function formatTime(time) {
        const text = String(time || '').trim();
        if (!text) return '--';
        return text;
    }

    /**
     * Map a backend BookingResponse into the existing card
     * shape. Only real backend fields are used; anything the
     * booking API does not expose is left out (no fake data).
     * @param {Object} b  backend BookingResponse
     * @returns {Object}
     */
    function mapBooking(b) {
        const statusKey = String(b.status || 'pending').toLowerCase();
        const status = STATUS_MAP[statusKey] || { label: escapeHtml(b.status || '--'), css: 'booking-status--pending' };
        const date = parseDate(b.booking_date);

        return {
            id: b.id,
            name: b.worker_name || '--',
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

    /**
     * Render a single booking card.
     * @param {Object} b
     * @returns {string} HTML string
     */
    function renderCard(b) {
        const ratingRow = (b.rating != null)
            ? `<div class="booking-rating" aria-label="Rated ${Number(b.rating).toFixed(1)} out of 5">
                    <span class="stars" aria-hidden="true">${buildStars(Number(b.rating))}</span>
                    <span class="rating-value">${Number(b.rating).toFixed(1)}</span>
                </div>`
            : '';

        const metaRow = `
            <div class="booking-meta">
                <span><span class="meta-label">Date:</span><span class="meta-value">${escapeHtml(b.date)}</span></span>
                <span><span class="meta-label">Time:</span><span class="meta-value">${escapeHtml(b.time)}</span></span>
            </div>`;

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
                ${metaRow}
            </article>
        `.trim();
    }

    /**
     * Render a grouped section.
     * @param {string} groupKey
     * @param {Array} items
     * @returns {string} HTML string
     */
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

    /**
     * Group bookings into today/yesterday/older, render each
     * non-empty group, and write the HTML into the feed.
     * @param {Array} bookings
     * @param {HTMLElement} container
     * @param {HTMLElement} emptyState
     */
    function renderFeed(bookings, container, emptyState) {
        const groups = { today: [], yesterday: [], older: [] };
        bookings.forEach((b) => {
            if (groups[b.group]) groups[b.group].push(b);
        });

        const html = ['today', 'yesterday', 'older']
            .map((key) => renderSection(key, groups[key]))
            .filter(Boolean)
            .join('');

        container.innerHTML = html;
        if (emptyState) emptyState.hidden = Boolean(html);
    }

    /**
     * Live-filter the real bookings against the search query.
     * Empty query returns the full list.
     * @param {Array} bookings
     * @param {string} query
     * @returns {Array}
     */
    function filterBookings(bookings, query) {
        const q = String(query || '').trim().toLowerCase();
        if (!q) return bookings.slice();

        return bookings.filter((b) => {
            const amount = b.amount != null ? String(b.amount) : '';
            return (
                b.name.toLowerCase().includes(q) ||
                b.occupation.toLowerCase().includes(q) ||
                b.status.toLowerCase().includes(q) ||
                b.date.toLowerCase().includes(q) ||
                b.time.toLowerCase().includes(q) ||
                b.address.toLowerCase().includes(q) ||
                amount.includes(q)
            );
        });
    }

    /**
     * Wire up the search input so the feed updates as the
     * user types against the real (already fetched) bookings.
     * @param {HTMLElement} container
     * @param {HTMLElement} emptyState
     * @param {Array} bookings
     */
    function initSearch(container, emptyState, bookings) {
        const input = document.getElementById('activitySearch');
        if (!input) return;

        input.addEventListener('input', function () {
            const filtered = filterBookings(bookings, input.value);
            renderFeed(filtered, container, emptyState);
            if (emptyState && !filtered.length && bookings.length) {
                emptyState.textContent = 'No bookings match your search.';
                emptyState.hidden = false;
            }
        });
    }

    /**
     * Show a lightweight loading state in the feed.
     * @param {HTMLElement} container
     * @param {HTMLElement} emptyState
     */
    function showLoading(container, emptyState) {
        container.innerHTML = '';
        if (emptyState) {
            emptyState.textContent = 'Loading your bookings...';
            emptyState.hidden = false;
        }
    }

    /**
     * Show a friendly error state in the feed.
     * @param {HTMLElement} container
     * @param {HTMLElement} emptyState
     * @param {string} message
     */
    function showError(container, emptyState, message) {
        container.innerHTML = '';
        if (emptyState) {
            emptyState.textContent = message;
            emptyState.hidden = false;
        }
    }

    /**
     * Show the empty state when the customer has no bookings.
     * @param {HTMLElement} emptyState
     */
    function showEmpty(emptyState) {
        if (emptyState) {
            emptyState.textContent = 'No bookings yet. When you book a professional, your history will appear here.';
            emptyState.hidden = false;
        }
    }

    /**
     * Fetch the customer's bookings from the backend and
     * render them.
     * @param {HTMLElement} container
     * @param {HTMLElement} emptyState
     */
    function loadBookings(container, emptyState) {
        const api = getApi();
        if (!api) {
            showError(container, emptyState, 'Booking service is unavailable right now. Please try again later.');
            return;
        }

        showLoading(container, emptyState);

        api.apiFetch('/api/bookings/customer/bookings')
            .then(function (response) {
                // api.js clears auth state on 401.
                if (response.status === 401) {
                    redirectToLogin();
                    return null;
                }
                if (response.status === 403) {
                    showError(container, emptyState, 'You are not allowed to view these bookings.');
                    return null;
                }
                if (response.status === 404) {
                    showError(container, emptyState, 'Your bookings could not be found.');
                    return null;
                }
                if (!response.ok) {
                    showError(container, emptyState, 'Unable to load your bookings. Please try again.');
                    return null;
                }
                return response.json();
            })
            .then(function (data) {
                if (!data) return;

                const bookings = (Array.isArray(data) ? data : []).map(mapBooking);
                if (!bookings.length) {
                    container.innerHTML = '';
                    showEmpty(emptyState);
                    return;
                }

                renderFeed(bookings, container, emptyState);
                initSearch(container, emptyState, bookings);
            })
            .catch(function () {
                showError(container, emptyState, 'Unable to connect to HandyHire. Please try again.');
            });
    }

    /**
     * Initialize the Activity page.
     */
    function init() {
        const feed = document.getElementById('activityFeed');
        const emptyState = document.getElementById('emptyState');
        if (!feed) return;

        // Booking history is a customer-only page.
        if (!hasSession()) {
            redirectToLogin();
            return;
        }

        loadBookings(feed, emptyState);
    }

    // Run after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();