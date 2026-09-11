/* =========================================================
   HandyHire - Customer Home JavaScript
   Default landing screen after login.
   Renders the service grid and wires up filter chips
   and primary navigation.
   ========================================================= */

(function () {
    'use strict';

    /**
     * Number of worker cards shown initially before the list is
     * expanded via the "View All" toggle.
     */
    const DISPLAY_LIMIT = 4;

    /**
     * Routes for the filter chips that have a dedicated page.
     * Chips without an entry here are treated as in-page only.
     */
    const CHIP_ROUTES = {
        'pre-booking': 'home-prebooking.html',
        'on-spot': 'home-onspot.html',
        'near-me': 'home-nearme.html',
        'budget': 'home-budget.html',
    };

    /**
     * Convert a worker name into a URL-safe slug used by
     * job-hire.html. The slug is also embedded as
     * `data-worker-slug` on every card so the click
     * delegate knows which worker was selected.
     * @param {string} name
     * @returns {string}
     */
    function makeSlug(name) {
        return String(name || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    /**
     * Generate a placeholder avatar data URL so the cards render
     * without any external image dependency.
     * @param {string} name
     * @returns {string} CSS background value
     */
    function getAvatarStyle(name) {
        // Pull initials for the placeholder
        const initials = name
            .split(' ')
            .map((part) => part.charAt(0).toUpperCase())
            .slice(0, 2)
            .join('');

        // Stable color per name
        const hue = Array.from(name).reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 360;

        const svg = `
            <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 72 72'>
                <defs>
                    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
                        <stop offset='0%' stop-color='hsl(${hue}, 35%, 70%)'/>
                        <stop offset='100%' stop-color='hsl(${(hue + 40) % 360}, 30%, 55%)'/>
                    </linearGradient>
                </defs>
                <rect width='72' height='72' fill='url(#g)'/>
                <text x='50%' y='54%' text-anchor='middle' font-family='Inter, sans-serif'
                      font-size='28' font-weight='700' fill='#ffffff' dominant-baseline='middle'>
                    ${initials}
                </text>
            </svg>
        `.trim();

        return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
    }

    /**
     * Render the service grid into the DOM from backend data.
     * @param {HTMLElement} container
     * @param {Array} workers  backend WorkerResponse objects
     */
    /**
     * Render the service grid into the DOM from backend data.
     * @param {HTMLElement} container
     * @param {Array} workers  backend WorkerResponse objects
     */
    function renderWorkers(container, workers) {
        if (!container) return;
        displayList = Array.isArray(workers) ? workers : [];
        renderDisplay(container);
    }

    /**
     * Get (or lazily create) the View All / Show Less toggle button
     * placed directly below the service grid.
     * @param {HTMLElement} container
     * @returns {HTMLElement}
     */
    function getViewAllButton(container) {
        const section = container.closest('.service-section');
        if (!section) return null;
        let btn = section.querySelector('[data-view-all]');
        if (btn) return btn;
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'view-all-btn';
        btn.dataset.viewAll = 'true';
        btn.addEventListener('click', function () {
            isExpanded = !isExpanded;
            renderDisplay(container);
        });
        container.parentNode.insertBefore(btn, container.nextSibling);
        return btn;
    }

    /**
     * Render the current display list, constrained to the first
     * DISPLAY_LIMIT cards unless expanded, and keep the toggle in sync.
     * @param {HTMLElement} container
     */
    function renderDisplay(container) {
        if (!container) return;

        const btn = getViewAllButton(container);

        if (!displayList.length) {
            container.innerHTML = `
                <p class="empty-state" style="grid-column: 1 / -1; text-align: center; color: var(--color-text-muted); padding: 32px 0;">
                    No professionals available right now.
                </p>
            `;
            if (btn) btn.hidden = true;
            return;
        }

        const shown = isExpanded ? displayList : displayList.slice(0, DISPLAY_LIMIT);

        const html = shown.map((worker) => {
            const card = window.HandyHireWorkers.toCard(worker);
            const name = window.HandyHireWorkers.escapeHtml(card.name);
            const profession = window.HandyHireWorkers.escapeHtml(card.profession);
            const avatar = card.profileImage
                ? 'url("' + card.profileImage + '")'
                : getAvatarStyle(card.name);

            return `
                <article class="worker-card" tabindex="0"
                         data-worker-id="${card.id}"
                         data-worker-slug="${window.HandyHireWorkers.escapeHtml(card.slug)}"
                         data-worker-name="${name}"
                         aria-label="${name}, ${profession}, rated ${card.rating.toFixed(1)} out of 5, ${card.priceText}">
                    <div class="worker-avatar" style="background-image: ${avatar}" aria-hidden="true"></div>
                    <h3 class="worker-name">${name}</h3>
                    <p class="worker-profession">${profession}</p>
                    <div class="worker-meta">
                        <span class="worker-rating">
                            <span class="star" aria-hidden="true">&#9733;</span>${card.rating.toFixed(1)}
                        </span>
                        <span class="worker-price">${card.priceText}</span>
                    </div>
                </article>
            `;
        }).join('');

        container.innerHTML = html;

        if (btn) {
            btn.hidden = displayList.length <= DISPLAY_LIMIT;
            btn.textContent = isExpanded ? 'Show Less' : 'View All';
        }
    }

    /**
     * Wire up the filter chips so the active one toggles locally
     * and chips with a target page navigate to that page.
     */
    function initFilterChips() {
        const chips = document.querySelectorAll('.filter-chips .chip');
        if (!chips.length) return;

        chips.forEach((chip) => {
            chip.addEventListener('click', function () {
                const filter = chip.dataset.filter;
                const target = chip.dataset.target;

                // Always update visual state first
                chips.forEach((c) => {
                    c.classList.remove('is-active');
                    c.setAttribute('aria-pressed', 'false');
                });
                chip.classList.add('is-active');
                chip.setAttribute('aria-pressed', 'true');

                // Navigate if the chip has a target page
                if (target) {
                    window.location.href = target;
                } else if (filter === 'all') {
                    // "All" stays on the current page; just scroll to top
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        });
    }

    /**
     * Wire up the top navigation tabs that don't yet have a page.
     */
    function initTopNav() {
        const activityTab = document.getElementById('activityTab');

        if (activityTab) {
            activityTab.addEventListener('click', function (event) {
                event.preventDefault();
                window.location.href = 'activity.html';
            });
        }
    }

    /**
     * Make worker cards clickable so tapping a professional
     * opens the Job Hire (worker details) page for that
     * specific worker. The selected worker is resolved via
     * ?worker=<slug>. job-hire.js reads the slug and
     * populates the page with the correct record.
     */
    function initWorkerCards() {
        const grid = document.getElementById('serviceGrid');
        if (!grid) return;

        function navigate(card) {
            const workerId = card.getAttribute('data-worker-id');
            const slug = card.getAttribute('data-worker-slug')
                || card.getAttribute('data-worker-name');
            if (!workerId) return; // ID is the source of truth for navigation
            const url = 'job-hire.html?worker_id='
                + encodeURIComponent(workerId);
            try {
                if (slug) {
                    sessionStorage.setItem('handyhire.selectedWorkerSlug', slug);
                }
                sessionStorage.setItem('handyhire.selectedWorkerId', workerId);
                sessionStorage.setItem('handyhire.customer.previousPage', 'home.html');
            } catch (e) {
                // Ignore storage errors.
            }
            window.location.href = url;
        }

        grid.addEventListener('click', function (event) {
            const card = event.target.closest('.worker-card');
            if (!card || !grid.contains(card)) return;
            navigate(card);
        });

        grid.addEventListener('keydown', function (event) {
            const card = event.target.closest('.worker-card');
            if (!card || !grid.contains(card)) return;
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                navigate(card);
            }
        });
    }

    /**
     * Make the package tiles near the bottom of the Home
     * page keyboard-accessible. Browsers fire Enter on
     * <a> natively, but not Space, so we add a Space
     * delegation here. Click / Enter are already handled
     * by the browser via the href.
     */
    function initPackageTiles() {
        const section = document.querySelector('.pkg-section');
        if (!section) return;

        function storePreviousPage() {
            try {
                sessionStorage.setItem('handyhire.customer.previousPage', 'home.html');
            } catch (e) {}
        }

        section.addEventListener('click', function (event) {
            const tile = event.target.closest('.pkg-tile');
            if (!tile || !section.contains(tile)) return;
            storePreviousPage();
        });

        section.addEventListener('keydown', function (event) {
            if (event.key !== ' ') return;
            const tile = event.target.closest('.pkg-tile');
            if (!tile || !section.contains(tile)) return;
            event.preventDefault();
            storePreviousPage();
            const href = tile.getAttribute('href');
            if (href) window.location.href = href;
        });
    }

    /**
     * All workers currently loaded on this page. Used by the
     * live search filter so we do not re-query the backend
     * on every keystroke.
     */
    let currentWorkers = [];

    /**
     * The currently displayed (already filtered + sorted) worker list.
     * Kept in full so the "View All" toggle can reveal every card
     * without a second backend request.
     */
    let displayList = [];

    /**
     * Whether the full list is currently expanded.
     */
    let isExpanded = false;

    /**
     * Load workers from the backend and render them into the
     * grid. Shows a loading state, then renders real data or a
     * friendly error/empty message using the existing styling.
     */
    function loadWorkers(container) {
        if (!container) return;
        container.innerHTML = `
            <p class="empty-state" style="grid-column: 1 / -1; text-align: center; color: var(--color-text-muted); padding: 32px 0;">
                Loading professionals...
            </p>
        `;

        const api = window.HandyHireWorkers
            ? window.HandyHireWorkers.fetchWorkers
            : null;
        if (!api) {
            container.innerHTML = `
                <p class="empty-state" style="grid-column: 1 / -1; text-align: center; color: var(--color-text-muted); padding: 32px 0;">
                    Unable to load professionals.
                </p>
            `;
            return;
        }

        api()
            .then((workers) => {
                currentWorkers = Array.isArray(workers) ? workers : [];
                applySearch();
            })
            .catch(() => {
                container.innerHTML = `
                    <p class="empty-state" style="grid-column: 1 / -1; text-align: center; color: var(--color-text-muted); padding: 32px 0;">
                        Unable to load professionals right now. Please try again later.
                    </p>
                `;
            });
    }

    /**
     * Build a lowercase text token for search matching.
     * @param {string} value
     * @returns {string}
     */
    function searchToken(value) {
        return String(value == null ? '' : value).toLowerCase();
    }

    /**
     * Filter the already-loaded worker list by the current
     * search query and sort, then render the matching subset.
     */
    function applySearch() {
        isExpanded = false;
        const container = document.getElementById('serviceGrid');
        if (!container) return;

        const input = document.getElementById('workerSearch');
        const query = input ? searchToken(input.value) : '';

        const sortSelect = document.getElementById('workerSort');
        const sort = sortSelect ? sortSelect.value : '';

        const workers = currentWorkers.filter(function (worker) {
            if (!query) return true;
            const raw = worker.raw || worker;
            const name = searchToken(raw.full_name || raw.name);
            const profession = searchToken(raw.profession);
            const location = searchToken(raw.location);
            const availability = searchToken(raw.availability);
            return (
                name.indexOf(query) !== -1 ||
                profession.indexOf(query) !== -1 ||
                location.indexOf(query) !== -1 ||
                availability.indexOf(query) !== -1
            );
        });

        const sorted = window.HandyHireWorkers && window.HandyHireWorkers.sortWorkers
            ? window.HandyHireWorkers.sortWorkers(workers, sort)
            : workers;

        renderWorkers(container, sorted);
    }

    /**
     * Wire up the search input so the worker grid filters
     * live as the customer types.
     */
    function initSearch() {
        const input = document.getElementById('workerSearch');
        if (!input) return;

        input.addEventListener('input', function () {
            applySearch();
        });
    }

    /**
     * Wire up the sort dropdown so the worker grid re-sorts
     * live without a backend round-trip.
     */
    function initSort() {
        const select = document.getElementById('workerSort');
        if (!select) return;

        select.addEventListener('change', function () {
            applySearch();
        });
    }

    /**
     * Initialize the home page.
     */
    function init() {
        console.log('[HandyHire][home][debug] init start');
        if (!(window.HandyHireAPI && window.HandyHireAPI.requireRole('customer'))) {
            console.log('[HandyHire][home][debug] init requireRole=false -> redirect');
            return;
        }
        console.log('[HandyHire][home][debug] init requireRole=true -> render');
        loadWorkers(document.getElementById('serviceGrid'));
        initFilterChips();
        initWorkerCards();
        initPackageTiles();
        initTopNav();
        initSearch();
        initSort();
    }

    // Run after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
