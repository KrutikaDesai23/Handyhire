/* =========================================================
   HandyHire - Team Packages JavaScript
   Renders a vertical list of WHOLE-TEAM package cards.
   Each card represents booking the entire team (no
   individual worker rates). Live filtering supports both
   the search input and the Team Size select.
   Selecting a card routes to team-page.html.
   ========================================================= */

(function () {
    'use strict';

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
     * Generate a placeholder avatar data URL so cards
     * render meaningfully without external images.
     * @param {string} name
     * @returns {string} CSS background value
     */
    function buildAvatar(name) {
        const initials = name
            .split(' ')
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase())
            .slice(0, 2)
            .join('') || '?';

        const hue = Array.from(name).reduce(
            (sum, ch) => sum + ch.charCodeAt(0),
            0
        ) % 360;

        const svg = `
            <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'>
                <defs>
                    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
                        <stop offset='0%' stop-color='hsl(${hue}, 35%, 70%)'/>
                        <stop offset='100%' stop-color='hsl(${(hue + 40) % 360}, 30%, 55%)'/>
                    </linearGradient>
                </defs>
                <circle cx='40' cy='40' r='40' fill='url(#g)'/>
                <text x='50%' y='54%' text-anchor='middle'
                      font-family='Inter, sans-serif' font-size='30'
                      font-weight='700' fill='#ffffff' dominant-baseline='middle'>
                    ${initials}
                </text>
            </svg>
        `.trim();

        return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)})`;
    }

    /**
     * Build a "★ ★ ★ ★ ☆" style stars string for a rating.
     * @param {number} rating
     * @returns {string}
     */
    function buildStars(rating) {
        const full = Math.floor(rating);
        const empty = 5 - full;
        return '\u2605'.repeat(full) + '\u2606'.repeat(empty);
    }

    /**
     * Format a team size label like "4 members".
     * @param {number} size
     * @returns {string}
     */
    function formatSize(size) {
        const n = Number(size) || 0;
        return n + ' member' + (n === 1 ? '' : 's');
    }

    /**
     * Format a price for display as Indian Rupees.
     * @param {number|string} price
     * @returns {string}
     */
    function formatPrice(price) {
        return '\u20B9' + Number(price || 0).toLocaleString();
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
     * Render a single WHOLE-TEAM package card as an <li>.
     * @param {Object} pkg
     * @returns {string} HTML string
     */
    function renderCard(pkg) {
        const workers = Array.isArray(pkg.workers) ? pkg.workers : [];
        const memberBullets = workers
            .map((w) => `<li>${escapeHtml(w.full_name || w.profession || 'Worker')}${w.profession ? ' &middot; ' + escapeHtml(w.profession) : ''}</li>`)
            .join('');

        const labelSummary = [
            formatSize(workers.length),
            pkg.category || pkg.package_type || 'Team Package',
        ].join(' &middot; ');

        return `
            <li>
                <article class="package-card" tabindex="0"
                         data-package-id="${escapeHtml(String(pkg.id))}"
                         data-name="${escapeHtml(pkg.name)}"
                         aria-label="${escapeHtml(pkg.name)} team package, ${labelSummary}">
                    <div class="package-avatar" style="background-image: ${buildAvatar(pkg.name)}" aria-hidden="true"></div>
                    <div class="package-text">
                        <p class="package-name">${escapeHtml(pkg.name)}</p>
                        <p class="package-description">${escapeHtml(pkg.description || '')}</p>
                        <div class="package-rating" aria-label="Team rated ${Number(pkg.rating || 0).toFixed(1)} out of 5">
                            <span class="stars" aria-hidden="true">${buildStars(pkg.rating || 0)}</span>
                            <span class="rating-value">${Number(pkg.rating || 0).toFixed(1)}</span>
                        </div>
                        <p class="package-section-label">Team includes:</p>
                        <ul class="package-members">
                            ${memberBullets}
                        </ul>
                        <div class="package-price-row">
                            <span class="package-price-label">${escapeHtml(pkg.duration || 'Team package')}${pkg.location ? ' &middot; ' + escapeHtml(pkg.location) : ''}</span>
                            <span class="package-price-value">${formatPrice(pkg.price)} / hour</span>
                        </div>
                        <button type="button"
                                class="package-book-cta"
                                data-target-package-id="${escapeHtml(String(pkg.id))}">
                            Book Whole Team
                        </button>
                    </div>
                </article>
            </li>
        `.trim();
    }

    /**
     * Render the full package list into the container.
     * @param {Array} packages
     * @param {HTMLElement} container
     * @param {HTMLElement} emptyState
     */
    function renderList(packages, container, emptyState) {
        container.innerHTML = packages.map(renderCard).join('');
        if (emptyState) emptyState.hidden = packages.length > 0;
    }

    /**
     * Filter packages by search query and team size.
     * @param {Array} packages
     * @param {string} query
     * @param {string} teamSize "all" | "2" | "3" | "4" | "5"
     * @returns {Array}
     */
    function filterPackages(packages, query, teamSize) {
        const q = String(query || '').trim().toLowerCase();
        const sizeFilter = String(teamSize || 'all');

        return packages.filter((pkg) => {
            const workers = Array.isArray(pkg.workers) ? pkg.workers : [];
            const size = workers.length;
            const searchText = [
                pkg.name,
                pkg.description,
                pkg.location,
                pkg.duration,
                pkg.availability,
                pkg.category,
            ].filter(Boolean).join(' ').toLowerCase();

            const workerText = workers
                .map((w) => [w.full_name, w.profession].filter(Boolean).join(' '))
                .join(' ')
                .toLowerCase();

            const matchesText = !q
                || searchText.includes(q)
                || workerText.includes(q);

            const matchesSize = (
                sizeFilter === 'all' ||
                (sizeFilter === '5' ? size >= 5 : size === Number(sizeFilter))
            );

            return matchesText && matchesSize;
        });
    }

    /**
     * Wire up the search input and Team Size select so the
     * list updates as either changes.
     */
    function initFilters(packages, container, emptyState) {
        const input = document.getElementById('packageSearch');
        const select = document.getElementById('teamSizeSelect');
        if (!input && !select) return;

        function update() {
            const q = input ? input.value : '';
            const size = select ? select.value : 'all';
            renderList(filterPackages(packages, q, size), container, emptyState);
        }

        if (input) input.addEventListener('input', update);
        if (select) select.addEventListener('change', update);
    }

    /**
     * Persist the selected package so the next page
     * (team-page.html, booking.html) can read it.
     * @param {Object} pkg
     */
    function persistSelectedPackage(pkg) {
        try {
            sessionStorage.setItem('handyhire.selectedPackage', JSON.stringify({
                id: pkg.id,
                name: pkg.name,
            }));
        } catch (e) {
            // Ignore storage errors (private mode etc.).
        }
    }

    /**
     * Resolve the package ID from the clicked element.
     * @param {HTMLElement} target
     * @param {HTMLElement} container
     * @returns {string|null}
     */
    function resolvePackageId(target, container) {
        const card = target.closest('.package-card');
        if (!card || !container.contains(card)) return null;
        return card.getAttribute('data-package-id') || null;
    }

    /**
     * Wire up click + Enter / Space on every package card
     * AND on the "Book Whole Team" CTA inside each card.
     * Both routes select the whole team and forward to
     * team-page.html - never to booking.html directly.
     */
    function initCardNavigation(packages, container) {
        if (!container) return;

        function navigate(packageId) {
            if (!packageId) return;
            const pkg = packages.find((p) => String(p.id) === String(packageId));
            if (pkg) persistSelectedPackage(pkg);
            try {
                sessionStorage.setItem('handyhire.customer.previousPage', 'team-package.html');
            } catch (e) {}
            window.location.href = 'team-page.html?package_id=' + encodeURIComponent(packageId);
        }

        container.addEventListener('click', function (event) {
            const cta = event.target.closest('.package-book-cta');
            if (cta && container.contains(cta)) {
                const id = cta.getAttribute('data-target-package-id')
                    || resolvePackageId(cta, container);
                navigate(id);
                return;
            }
            const card = event.target.closest('.package-card');
            if (!card || !container.contains(card)) return;
            navigate(card.getAttribute('data-package-id'));
        });

        container.addEventListener('keydown', function (event) {
            if (event.key !== 'Enter' && event.key !== ' ') return;

            const cta = event.target.closest('.package-book-cta');
            if (cta && container.contains(cta)) {
                event.preventDefault();
                const id = cta.getAttribute('data-target-package-id')
                    || resolvePackageId(cta, container);
                navigate(id);
                return;
            }
            const card = event.target.closest('.package-card');
            if (!card || !container.contains(card)) return;
            event.preventDefault();
            navigate(card.getAttribute('data-package-id'));
        });
    }

    /**
      * Wire the Back button to the customer home page
      * deterministically so it never reopens the Team
      * details page via browser-history navigation.
      */
    function initBackButton() {
        const back = document.getElementById('backLink');
        if (!back) return;
        back.addEventListener('click', function (event) {
            event.preventDefault();
            window.location.href = 'home.html';
        });
    }

    /**
     * Show an error state inside the list container.
     */
    function showError(container, emptyState, message) {
        if (container) container.innerHTML = '<li class="error-state">' + escapeHtml(message) + '</li>';
        if (emptyState) emptyState.hidden = true;
    }

    /**
     * Initialize the Team Packages page.
     */
    function init() {
        if (!(window.HandyHireAPI && window.HandyHireAPI.requireRole('customer'))) return;
        const list = document.getElementById('packageList');
        const emptyState = document.getElementById('emptyState');
        if (!list) return;

        const api = getApi();
        if (!api) {
            showError(list, emptyState, 'Unable to load packages. Please try again later.');
            return;
        }

        api.apiFetch('/api/packages?package_type=team')
            .then(function (response) {
                if (response.status === 401) {
                    api.clearAuth();
                    window.location.href = 'login.html';
                    return [];
                }
                if (!response.ok) throw new Error('Failed to load packages');
                return response.json();
            })
            .then(function (packages) {
                const data = Array.isArray(packages) ? packages : [];
                renderList(data, list, emptyState);
                initFilters(data, list, emptyState);
                initCardNavigation(data, list);
            })
            .catch(function () {
                showError(list, emptyState, 'Unable to load packages. Please try again.');
            });

        initBackButton();
    }

    // Run after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
