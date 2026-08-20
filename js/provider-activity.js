/* =========================================================
   HandyHire - Activity / Booking History JavaScript
   Renders bookings grouped by Today / Yesterday / a fixed
   historical date ("11 May") and provides live filtering
   by customer name, occupation, status, date, or time.
   ========================================================= */

(function () {
    'use strict';

    /**
     * Sample booking history. The first Today card is
     * "Krutika Desai / Engineer" per the design reference.
     * In production this would be fetched from an API keyed
     * to the logged-in customer.
     *
     * `group` is one of:
     *   - 'today'
     *   - 'yesterday'
     *   - 'older'  (rendered under the historical date label)
     *
     * The historical label itself is defined in SECTION_TITLES.
     */
    const BOOKINGS = [
        {
            name: 'Krutika Desai',
            occupation: 'Engineer',
            rating: 4.8,
            status: 'Confirmed',
            date: 'Today, 05 Aug',
            time: '10:30 AM',
            group: 'today',
        },
        {
            name: 'Anita Sharma',
            occupation: 'Electrician',
            rating: 4.7,
            status: 'Pending',
            date: 'Today, 05 Aug',
            time: '02:15 PM',
            group: 'today',
        },
        {
            name: 'Suresh Patel',
            occupation: 'Carpenter',
            rating: 4.6,
            status: 'Completed',
            date: 'Today, 05 Aug',
            time: '06:00 PM',
            group: 'today',
        },
        {
            name: 'Priya Singh',
            occupation: 'Cleaner',
            rating: 4.9,
            status: 'Completed',
            date: 'Yesterday, 04 Aug',
            time: '09:00 AM',
            group: 'yesterday',
        },
        {
            name: 'Mohan Das',
            occupation: 'Painter',
            rating: 4.5,
            status: 'Cancelled',
            date: 'Yesterday, 04 Aug',
            time: '04:45 PM',
            group: 'yesterday',
        },
        {
            name: 'Lata Verma',
            occupation: 'AC Repair',
            rating: 4.8,
            status: 'Confirmed',
            date: 'Yesterday, 04 Aug',
            time: '11:30 AM',
            group: 'yesterday',
        },
        {
            name: 'Arjun Mehta',
            occupation: 'Handyman',
            rating: 4.6,
            status: 'Completed',
            date: '11 May 2026',
            time: '08:15 AM',
            group: 'older',
        },
        {
            name: 'Neha Iyer',
            occupation: 'Pest Control',
            rating: 4.4,
            status: 'Completed',
            date: '11 May 2026',
            time: '01:00 PM',
            group: 'older',
        },
    ];

    /**
     * Title shown above each section's cards. The "older"
     * section uses a fixed historical date label per the
     * design reference.
     */
    const SECTION_TITLES = {
        today:     'Today',
        yesterday: 'Yesterday',
        older:     '11 May',
    };

    /**
     * Build a "★ ★ ★ ★ ★" style stars string for a rating.
     * @param {number} rating
     * @returns {string}
     */
    function buildStars(rating) {
        const full = Math.floor(rating);
        const empty = 5 - full;
        return '\u2605'.repeat(full) + '\u2606'.repeat(empty);
    }

    /**
     * Normalize a status string into a CSS modifier.
     * @param {string} status
     * @returns {string}
     */
    function statusClass(status) {
        return 'booking-status booking-status--' + String(status).toLowerCase();
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
     * Render a single booking card.
     * @param {Object} b
     * @returns {string} HTML string
     */
    function renderCard(b) {
        return `
            <article class="booking-card" tabindex="0"
                     aria-label="Booking with ${escapeHtml(b.name)}, ${escapeHtml(b.occupation)}, ${escapeHtml(b.status)} on ${escapeHtml(b.date)} at ${escapeHtml(b.time)}">
                <div class="booking-top">
                    <div>
                        <p class="booking-name">${escapeHtml(b.name)}</p>
                        <p class="booking-occupation">${escapeHtml(b.occupation)}</p>
                    </div>
                    <span class="${statusClass(b.status)}">${escapeHtml(b.status)}</span>
                </div>
                <div class="booking-rating" aria-label="Rated ${b.rating.toFixed(1)} out of 5">
                    <span class="stars" aria-hidden="true">${buildStars(b.rating)}</span>
                    <span class="rating-value">${b.rating.toFixed(1)}</span>
                </div>
                <div class="booking-meta">
                    <span><span class="meta-label">Date:</span><span class="meta-value">${escapeHtml(b.date)}</span></span>
                    <span><span class="meta-label">Time:</span><span class="meta-value">${escapeHtml(b.time)}</span></span>
                </div>
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
     * Group bookings by their `group` field, render each
     * non-empty group into its own section, and write the
     * combined HTML into the feed container.
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
     * Live-filter bookings against the search query.
     * Empty query returns the full list.
     * @param {string} query
     * @returns {Array}
     */
    function filterBookings(query) {
        const q = String(query || '').trim().toLowerCase();
        if (!q) return BOOKINGS.slice();

        return BOOKINGS.filter((b) => {
            return (
                b.name.toLowerCase().includes(q) ||
                b.occupation.toLowerCase().includes(q) ||
                b.status.toLowerCase().includes(q) ||
                b.date.toLowerCase().includes(q) ||
                b.time.toLowerCase().includes(q)
            );
        });
    }

    /**
     * Wire up the search input so the feed updates as the
     * user types.
     */
    function initSearch(container, emptyState) {
        const input = document.getElementById('activitySearch');
        if (!input) return;

        input.addEventListener('input', function () {
            const filtered = filterBookings(input.value);
            renderFeed(filtered, container, emptyState);
        });
    }

    /**
     * Initialize the Activity page.
     */
    function init() {
        const feed = document.getElementById('activityFeed');
        const emptyState = document.getElementById('emptyState');
        if (!feed) return;

        renderFeed(BOOKINGS, feed, emptyState);
        initSearch(feed, emptyState);
    }

    // Run after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
