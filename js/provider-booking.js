/* =========================================================
   HandyHire - Booking Page JavaScript
   Renders the worker avatar, wires up live total-cost
   calculation, and submits the booking to booking-success.html.
   ========================================================= */

(function () {
    'use strict';

    /**
     * Default worker for the single-worker booking flow.
     * In production this would be loaded from a query
     * parameter or session state.
     */
    const WORKER = {
        name: 'Ravi Kumar',
    };

    /**
     * Read the stored selected team (from team-package /
     * team-page). When present we show "Booking: <Team>"
     * instead of the single-worker header.
     * @returns {string|null}
     */
    function readSelectedTeam() {
        try {
            const stored = sessionStorage.getItem('handyhire.selectedTeam');
            return stored && String(stored).trim() ? stored : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Render the booking subject: either a whole team
     * ("Booking: <Team Name>") or a single worker.
     */
    function initWorkerHeader() {
        const avatar = document.getElementById('workerAvatar');
        const name = document.getElementById('workerName');
        const mode = document.getElementById('workerMode');
        const team = readSelectedTeam();

        if (team) {
            if (name) name.textContent = team;
            if (mode) {
                mode.textContent = 'Booking: Team';
                mode.hidden = false;
            }
            if (avatar) avatar.style.backgroundImage = buildAvatar(team);
        } else {
            if (avatar) avatar.style.backgroundImage = buildAvatar(WORKER.name);
            if (name) name.textContent = WORKER.name;
            if (mode) {
                mode.hidden = true;
            }
        }
    }

    /**
     * Pricing for the booking.
     */
    const HOURLY_RATE = 250;

    /**
     * Generate a placeholder avatar data URL so the
     * worker header renders without external image deps.
     * @param {string} name
     * @returns {string} CSS background value
     */
    function buildAvatar(name) {
        const initials = name
            .split(' ')
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase())
            .slice(0, 2)
            .join('') || 'W';

        const hue = Array.from(name).reduce(
            (sum, ch) => sum + ch.charCodeAt(0),
            0
        ) % 360;

        const svg = `
            <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'>
                <defs>
                    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
                        <stop offset='0%' stop-color='hsl(${hue}, 35%, 70%)'/>
                        <stop offset='100%' stop-color='hsl(${(hue + 40) % 360}, 30%, 55%)'/>
                    </linearGradient>
                </defs>
                <circle cx='60' cy='60' r='60' fill='url(#g)'/>
                <text x='50%' y='54%' text-anchor='middle'
                      font-family='Inter, sans-serif' font-size='44'
                      font-weight='700' fill='#ffffff' dominant-baseline='middle'>
                    ${initials}
                </text>
            </svg>
        `.trim();

        return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
    }

    /**
     * Format a rupee amount like 250 -> "\u20B9250".
     * @param {number} amount
     * @returns {string}
     */
    function formatRupees(amount) {
        return '\u20B9' + Number(amount).toLocaleString('en-IN');
    }

    /**
     * Set the date input's default value to today and its
     * minimum to today so past dates can't be selected.
     */
    function initDateDefaults() {
        const input = document.getElementById('scheduleDate');
        if (!input) return;

        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;

        if (!input.value) input.value = todayStr;
        input.min = todayStr;
    }

    /**
     * Read the currently selected hours, recompute the
     * total cost, and write it into the #totalCost element.
     */
    function updateTotal() {
        const select = document.getElementById('hoursSelect');
        const total = document.getElementById('totalCost');
        if (!select || !total) return;

        const hours = Math.max(1, Number(select.value) || 1);
        total.textContent = formatRupees(hours * HOURLY_RATE);
    }

    /**
     * Wire up the hour dropdown so the total updates live.
     */
    function initTotalLiveUpdate() {
        const select = document.getElementById('hoursSelect');
        if (!select) return;

        select.addEventListener('change', updateTotal);
        // Run once so the initial value matches the markup.
        updateTotal();
    }

    /**
     * Wire up the booking form's submit handler. Validates
     * the date and routes the user to booking-success.html.
     */
    function initBookingSubmit() {
        const form = document.getElementById('bookingForm');
        if (!form) return;

        form.addEventListener('submit', function (event) {
            event.preventDefault();

            const dateInput = document.getElementById('scheduleDate');
            const select = document.getElementById('hoursSelect');

            // Date is required - bail out (and let the browser
            // surface its native validation message) if empty.
            if (dateInput && !dateInput.value) {
                dateInput.reportValidity();
                return;
            }

            const hours = select ? Math.max(1, Number(select.value) || 1) : 1;
            const total = hours * HOURLY_RATE;

            // TODO: replace with a real API call once the
            // backend is wired up.
            const booking = {
                worker: WORKER.name,
                date: dateInput ? dateInput.value : '',
                hours: hours,
                total: total,
            };

            // Persist a small payload so the success page can
            // display the booking summary.
            try {
                sessionStorage.setItem('handyhire.lastBooking', JSON.stringify(booking));
            } catch (e) {
                // Ignore storage errors (private mode etc.) -
                // navigation still works.
            }

            window.location.href = 'provider-booking-success.html';
        });
    }

    /**
     * Set the Back button href from sessionStorage so it
     * returns to the exact previous worker page (multitasking
     * package or team page) rather than a hardcoded fallback.
     */
    function initBackButton() {
        const back = document.getElementById('backLink');
        if (!back) return;
        try {
            const prev = sessionStorage.getItem('handyhire.provider.previousPage');
            if (prev && prev.trim()) {
                back.setAttribute('href', prev.trim());
            }
        } catch (e) {
            // Keep the HTML fallback.
        }
    }

    /**
     * Initialize the Booking page.
     */
    function init() {
        initBackButton();
        initWorkerHeader();
        initDateDefaults();
        initTotalLiveUpdate();
        initBookingSubmit();
    }

    // Run after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
