/* =========================================================
   HandyHire - Multitasking Packages JavaScript
   Renders a vertical list of package cards with avatar,
   name, skills and star rating. Live filtering is supported
   via the search input. Navigation is intentionally not
   connected yet.
   ========================================================= */

(function () {
    'use strict';

    /**
     * Published multitasking packages loaded from the backend.
     */
    let allPackages = [];

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

        return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
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
      * Render a single package card as an <li>.
     * @param {Object} pkg
     * @returns {string} HTML string
     */
    function renderCard(pkg) {
        var skillsLine = (pkg.services || [])
            .map(function (service) {
                return escapeHtml(service.name);
            })
            .join(' \u2022 ');

        var metaTags = [];

        if (pkg.duration) {
            metaTags.push(
                '<span class="package-meta-tag">' +
                    '<span class="package-meta-icon">⏱</span>' +
                    escapeHtml(pkg.duration) +
                '</span>'
            );
        }

        if (pkg.location) {
            metaTags.push(
                '<span class="package-meta-tag">' +
                    '<span class="package-meta-icon">⌖</span>' +
                    escapeHtml(pkg.location) +
                '</span>'
            );
        }

        if (pkg.availability) {
            metaTags.push(
                '<span class="package-meta-tag">' +
                    '<span class="package-meta-icon">◷</span>' +
                    escapeHtml(pkg.availability) +
                '</span>'
            );
        }

        return (
            '<li>' +
                '<article ' +
                    'class="package-card" ' +
                    'tabindex="0" ' +
                    'data-package-id="' +
                    pkg.id +
                    '" ' +
                    'aria-label="View ' +
                    escapeHtml(pkg.name) +
                    '">' +
                    '<div class="package-card-header">' +
                        '<div class="package-title-area">' +
                            '<h3 class="package-name">' +
                                escapeHtml(pkg.name) +
                            '</h3>' +
                            (
                                pkg.description
                                    ? '<p class="package-description">' +
                                        escapeHtml(pkg.description) +
                                      '</p>'
                                    : ''
                            ) +
                        '</div>' +
                        '<div class="package-price">' +
                            formatPrice(pkg.price) +
                        '</div>' +
                    '</div>' +
                    (
                        skillsLine
                            ? '<div class="package-service-box">' +
                                '<span class="package-section-label">' +
                                    'Services included' +
                                '</span>' +
                                '<p class="package-services">' +
                                    skillsLine +
                                '</p>' +
                              '</div>'
                            : ''
                    ) +
                    (
                        metaTags.length
                            ? '<div class="package-meta-row">' +
                                metaTags.join('') +
                              '</div>'
                            : ''
                    ) +
                '</article>' +
            '</li>'
        );
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
     * Live-filter packages against the search query.
     * Empty query returns the full list.
     * @param {string} query
     * @returns {Array}
     */
    function filterPackages(query) {
        var q = String(query || '').trim().toLowerCase();
        if (!q) return allPackages.slice();

        return allPackages.filter(function (pkg) {
            var skillText = (pkg.services || [])
                .map(function (service) { return service.name; })
                .join(' ')
                .toLowerCase();
            return (
                String(pkg.name || '').toLowerCase().includes(q) ||
                skillText.includes(q)
            );
        });
    }

    /**
     * Wire up the search input so the list updates as the
     * user types.
     */
    function initSearch(container, emptyState) {
        const input = document.getElementById('packageSearch');
        if (!input) return;

        input.addEventListener('input', function () {
            const filtered = filterPackages(input.value);
            if (emptyState && !filtered.length) {
                emptyState.textContent = 'No packages match your search.';
            }
            renderList(filtered, container, emptyState);
        });
    }

    /**
     * Wire up click + Enter / Space activation on each
     * package card so it routes to booking.html with the
     * selected package_id. Direct-worker booking is not
     * affected by this flow.
     */
    function initCardNavigation(container) {
        if (!container) return;

        container.addEventListener('click', function (event) {
            var card = event.target.closest('.package-card');
            if (!card || !container.contains(card)) return;
            try {
                sessionStorage.setItem('handyhire.customer.previousPage', 'multitasking-package.html');
            } catch (e) {}
            var packageId = card.getAttribute('data-package-id');
            if (packageId) {
                window.location.href = 'booking.html?package_id=' + encodeURIComponent(packageId);
            } else {
                window.location.href = 'booking.html';
            }
        });

        container.addEventListener('keydown', function (event) {
            var card = event.target.closest('.package-card');
            if (!card || !container.contains(card)) return;
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                try {
                    sessionStorage.setItem('handyhire.customer.previousPage', 'multitasking-package.html');
                } catch (e) {}
                var packageId = card.getAttribute('data-package-id');
                if (packageId) {
                    window.location.href = 'booking.html?package_id=' + encodeURIComponent(packageId);
                } else {
                    window.location.href = 'booking.html';
                }
            }
        });
    }

    /**
     * Set the Back button href from sessionStorage so it
     * returns to the exact previous customer page rather
     * than a hardcoded fallback, and wire up an explicit
     * click handler so navigation always fires.
     */
    function initBackButton() {
        const back = document.getElementById('backLink');
        if (!back) return;
        try {
            const prev = sessionStorage.getItem('handyhire.customer.previousPage');
            if (prev && prev.trim()) {
                back.setAttribute('href', prev.trim());
            }
        } catch (e) {
            // Keep the HTML fallback.
        }
        back.addEventListener('click', function (event) {
            event.preventDefault();
            const href = back.getAttribute('href');
            if (href) {
                window.location.href = href;
            }
        });
    }

    /**
     * Fetch multitasking packages from the backend and
     * render them.
     */
    async function loadPackages() {
        const list = document.getElementById('packageList');
        const emptyState = document.getElementById('emptyState');
        if (!list) return;

        if (emptyState) {
            emptyState.textContent = 'Loading packages...';
            emptyState.hidden = false;
        }
        list.innerHTML = '';

        if (!(window.HandyHireAPI && typeof window.HandyHireAPI.apiFetch === 'function')) {
            if (emptyState) {
                emptyState.textContent = 'Unable to load packages. Please try again.';
                emptyState.hidden = false;
            }
            return;
        }

        try {
            const resp = await window.HandyHireAPI.apiFetch('/api/packages?package_type=multitasking');

            if (!resp.ok) {
                throw new Error('API returned ' + resp.status);
            }

            const data = await resp.json();
            allPackages = Array.isArray(data) ? data.slice() : [];

            if (!allPackages.length) {
                if (emptyState) {
                    emptyState.textContent = 'No packages available.';
                    emptyState.hidden = false;
                }
                return;
            }

            if (emptyState) emptyState.hidden = true;
            renderList(allPackages, list, emptyState);
        } catch (e) {
            if (emptyState) {
                emptyState.textContent = 'Unable to load packages. Please try again.';
                emptyState.hidden = false;
            }
        }
    }

    /**
     * Initialize the Multitasking Packages page.
     */
    function init() {
        if (!(window.HandyHireAPI && window.HandyHireAPI.requireRole('customer'))) return;
        const list = document.getElementById('packageList');
        const emptyState = document.getElementById('emptyState');
        if (!list) return;

        initSearch(list, emptyState);
        initCardNavigation(list);
        initBackButton();
        loadPackages();
    }

    // Run after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
