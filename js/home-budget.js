/* =========================================================
   HandyHire - Budget Home JavaScript
   Variant of the Customer Home that only renders
   budget-friendly workers (under a set price ceiling).
   Reuses css/home.css.
   ========================================================= */

(function () {
    'use strict';

    /**
     * Budget ceiling in rupees. Only workers priced at or below
     * this value are shown.
     */
    const BUDGET_CEILING = 300;

    /**
     * Routes for the filter chips. "Budget" is the active chip
     * and has no target - the user is already on this page.
     */
    const CHIP_ROUTES = {
        'all': 'home.html',
        'pre-booking': 'home-prebooking.html',
        'on-spot': 'home-onspot.html',
        'near-me': 'home-nearme.html',
    };

    /**
     * Convert a worker name into a URL-safe slug used by
     * job-hire.html.
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
     * Load workers from the backend (filtered to the budget
     * ceiling) and render them into the grid.
     * @param {HTMLElement} container
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

        api({ max_price: BUDGET_CEILING })
            .then((workers) => {
                renderWorkers(container, workers);
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
     * Generate a placeholder avatar data URL so cards render
     * without any external image dependency.
     * @param {string} name
     * @returns {string} CSS background value
     */
    function getAvatarStyle(name) {
        const initials = name
            .split(' ')
            .map((part) => part.charAt(0).toUpperCase())
            .slice(0, 2)
            .join('');

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
     * Render the budget service grid into the DOM from backend
     * data.
     * @param {HTMLElement} container
     * @param {Array} workers  backend WorkerResponse objects
     */
    function renderWorkers(container, workers) {
        if (!container) return;

        if (!workers || !workers.length) {
            container.innerHTML = `
                <p class="empty-state" style="grid-column: 1 / -1; text-align: center; color: var(--color-text-muted); padding: 32px 0;">
                    No budget-friendly professionals available right now.
                </p>
            `;
            return;
        }

        const html = workers.map((worker) => {
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
                    <span class="budget-badge" aria-hidden="true">Under &#8377;${BUDGET_CEILING}</span>
                </article>
            `;
        }).join('');

        container.innerHTML = html;
    }

    /**
     * Wire up the filter chips so they navigate to the right page
     * based on the centralized CHIP_ROUTES map. The active chip
     * (budget) has no target and just stays in place.
     */
    function initFilterChips() {
        const chips = document.querySelectorAll('.filter-chips .chip');
        if (!chips.length) return;

        chips.forEach((chip) => {
            chip.addEventListener('click', function () {
                const filter = chip.dataset.filter;

                if (CHIP_ROUTES[filter]) {
                    window.location.href = CHIP_ROUTES[filter];
                    return;
                }

                chips.forEach((c) => {
                    c.classList.remove('is-active');
                    c.setAttribute('aria-pressed', 'false');
                });
                chip.classList.add('is-active');
                chip.setAttribute('aria-pressed', 'true');
                window.scrollTo({ top: 0, behavior: 'smooth' });
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
            if (!workerId) return;
            const url = 'job-hire.html?worker_id='
                + encodeURIComponent(workerId);
            try {
                if (slug) {
                    sessionStorage.setItem('handyhire.selectedWorkerSlug', slug);
                }
                sessionStorage.setItem('handyhire.selectedWorkerId', workerId);
                sessionStorage.setItem('handyhire.customer.previousPage', 'home-budget.html');
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
                sessionStorage.setItem('handyhire.customer.previousPage', 'home-budget.html');
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
     * Initialize the budget home page.
     */
    function init() {
        loadWorkers(document.getElementById('serviceGrid'));
        initFilterChips();
        initWorkerCards();
        initPackageTiles();
        initTopNav();
    }

    // Run after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
