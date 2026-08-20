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
        'all': 'provider-home.html',
        'pre-booking': 'provider-home-prebooking.html',
        'on-spot': 'provider-home-onspot.html',
        'near-me': 'provider-home-nearme.html',
    };

    /**
     * Convert a price string like "₹299" into a numeric value.
     * @param {string} priceStr
     * @returns {number}
     */
    function parsePrice(priceStr) {
        const digits = String(priceStr).replace(/[^\d]/g, '');
        return parseInt(digits, 10) || 0;
    }

    /**
     * Convert a worker name into a URL-safe slug used by
     * provider-job-hire.html.
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
     * Full worker pool. The budget filter is applied at render time
     * so adding / removing budget workers only requires editing this
     * list - no other code change needed.
     */
    const ALL_WORKERS = [
        { name: 'Ravi Kumar',   profession: 'Plumber',     price: '₹299', rating: 4.8, slug: makeSlug('Ravi Kumar') },
        { name: 'Anita Sharma', profession: 'Electrician', price: '₹349', rating: 4.7, slug: makeSlug('Anita Sharma') },
        { name: 'Suresh Patel', profession: 'Carpenter',   price: '₹399', rating: 4.6, slug: makeSlug('Suresh Patel') },
        { name: 'Priya Singh',  profession: 'Cleaner',     price: '₹249', rating: 4.9, slug: makeSlug('Priya Singh') },
        { name: 'Mohan Das',    profession: 'Painter',     price: '₹459', rating: 4.5, slug: makeSlug('Mohan Das') },
        { name: 'Lata Verma',   profession: 'AC Repair',   price: '₹549', rating: 4.8, slug: makeSlug('Lata Verma') },
        { name: 'Arjun Mehta',  profession: 'Handyman',    price: '₹199', rating: 4.6, slug: makeSlug('Arjun Mehta') },
        { name: 'Neha Iyer',    profession: 'Pest Control', price: '₹279', rating: 4.4, slug: makeSlug('Neha Iyer') },
    ];

    /**
     * Filter the workers list to only include budget-friendly options
     * (price <= BUDGET_CEILING), then sort them cheapest first.
     * @returns {Array}
     */
    function getBudgetWorkers() {
        return ALL_WORKERS
            .filter((w) => parsePrice(w.price) <= BUDGET_CEILING)
            .sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
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
     * Render the budget service grid into the DOM.
     * @param {HTMLElement} container
     */
    function renderWorkers(container) {
        if (!container) return;

        const workers = getBudgetWorkers();

        if (!workers.length) {
            container.innerHTML = `
                <p class="empty-state" style="grid-column: 1 / -1; text-align: center; color: var(--color-text-muted); padding: 32px 0;">
                    No budget-friendly professionals available right now.
                </p>
            `;
            return;
        }

        const html = workers.map((worker) => `
            <article class="worker-card" tabindex="0"
                     data-worker-slug="${worker.slug}"
                     data-worker-name="${worker.name}"
                     aria-label="${worker.name}, ${worker.profession}, rated ${worker.rating} out of 5, ${worker.price}">
                <div class="worker-avatar" style="background-image: ${getAvatarStyle(worker.name)}" aria-hidden="true"></div>
                <h3 class="worker-name">${worker.name}</h3>
                <p class="worker-profession">${worker.profession}</p>
                <div class="worker-meta">
                    <span class="worker-rating">
                        <span class="star" aria-hidden="true">&#9733;</span>${worker.rating.toFixed(1)}
                    </span>
                    <span class="worker-price">${worker.price}</span>
                </div>
                <span class="budget-badge" aria-hidden="true">Under &#8377;${BUDGET_CEILING}</span>
            </article>
        `).join('');

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
                window.location.href = 'provider-activity.html';
            });
        }
    }

    /**
     * Make worker cards clickable so tapping a professional
     * opens the Provider Person Details page for that specific
     * worker. The selected person is resolved via ?worker=<slug>
     * (and ?source=individual so the details page knows
     * which flow opened it). This is NOT the worker's own
     * profile - that page is reached from the top-nav "Profile".
     */
    function initWorkerCards() {
        const grid = document.getElementById('serviceGrid');
        if (!grid) return;

        function navigate(card) {
            const slug = card.getAttribute('data-worker-slug')
                || card.getAttribute('data-worker-name');
            if (!slug) return;
            try {
                sessionStorage.setItem('handyhire.provider.previousPage', 'provider-home-budget.html');
            } catch (e) {}
            const url = 'provider-job-hire.html?worker='
                + encodeURIComponent(slug)
                + '&source=individual';
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

        section.addEventListener('keydown', function (event) {
            if (event.key !== ' ') return;
            const tile = event.target.closest('.pkg-tile');
            if (!tile || !section.contains(tile)) return;
            event.preventDefault();
            const href = tile.getAttribute('href');
            if (href) window.location.href = href;
        });
    }

    /**
     * Initialize the budget home page.
     */
    function init() {
        renderWorkers(document.getElementById('serviceGrid'));
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
