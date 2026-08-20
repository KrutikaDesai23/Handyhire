/* =========================================================
   HandyHire - Multitasking Packages JavaScript
   Renders a vertical list of package cards with avatar,
   name, skills and star rating. The first card is
   "Krutika Desai" per the design reference. Live
   filtering is supported via the search input.
   Navigation is intentionally not connected yet.
   ========================================================= */

(function () {
    'use strict';

    /**
     * Sample multitasking package data. The first entry
     * is the reference card from the design image.
     */
    const PACKAGES = [
        {
            name: 'Krutika Desai',
            skills: ['Plumber', 'Electrician', 'Carpenter'],
            rating: 4.8,
        },
        {
            name: 'Anita Sharma',
            skills: ['Electrician', 'AC Repair', 'Handyman'],
            rating: 4.7,
        },
        {
            name: 'Suresh Patel',
            skills: ['Carpenter', 'Painter', 'Cleaner'],
            rating: 4.6,
        },
        {
            name: 'Priya Singh',
            skills: ['Cleaner', 'Pest Control', 'Cook'],
            rating: 4.9,
        },
        {
            name: 'Mohan Das',
            skills: ['Painter', 'Carpenter', 'Plumber'],
            rating: 4.5,
        },
        {
            name: 'Lata Verma',
            skills: ['AC Repair', 'Electrician', 'Handyman'],
            rating: 4.8,
        },
    ];

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
     * Render a single package card as an <li>.
     * @param {Object} pkg
     * @returns {string} HTML string
     */
    function renderCard(pkg) {
        const skillsLine = pkg.skills.join(' \u2022 ');
        return `
            <li>
                <article class="package-card" tabindex="0"
                         data-name="${escapeHtml(pkg.name)}"
                         aria-label="${escapeHtml(pkg.name)} package, skills ${escapeHtml(skillsLine)}, rated ${pkg.rating.toFixed(1)} out of 5">
                    <div class="package-avatar" style="background-image: ${buildAvatar(pkg.name)}" aria-hidden="true"></div>
                    <div class="package-text">
                        <p class="package-name">${escapeHtml(pkg.name)}</p>
                        <p class="package-skills">${escapeHtml(skillsLine)}</p>
                        <div class="package-rating" aria-label="Rated ${pkg.rating.toFixed(1)} out of 5">
                            <span class="stars" aria-hidden="true">${buildStars(pkg.rating)}</span>
                            <span class="rating-value">${pkg.rating.toFixed(1)}</span>
                        </div>
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
     * Live-filter packages against the search query.
     * Empty query returns the full list.
     * @param {string} query
     * @returns {Array}
     */
    function filterPackages(query) {
        const q = String(query || '').trim().toLowerCase();
        if (!q) return PACKAGES.slice();

        return PACKAGES.filter((pkg) => {
            const skillText = pkg.skills.join(' ').toLowerCase();
            return (
                pkg.name.toLowerCase().includes(q) ||
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
            renderList(filtered, container, emptyState);
        });
    }

    /**
     * Wire up click + Enter / Space activation on each
     * package card so it routes to booking.html. This is
     * the direct entry into the shared Booking Details
     * page; selecting a multitasking package must NOT
     * route through team-package.html or team-page.html.
     */
    function initCardNavigation(container) {
        if (!container) return;

        container.addEventListener('click', function (event) {
            const card = event.target.closest('.package-card');
            if (!card || !container.contains(card)) return;
            try {
                sessionStorage.setItem('handyhire.customer.previousPage', 'multitasking-package.html');
            } catch (e) {}
            window.location.href = 'booking.html';
        });

        container.addEventListener('keydown', function (event) {
            const card = event.target.closest('.package-card');
            if (!card || !container.contains(card)) return;
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                try {
                    sessionStorage.setItem('handyhire.customer.previousPage', 'multitasking-package.html');
                } catch (e) {}
                window.location.href = 'booking.html';
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
     * Initialize the Multitasking Packages page.
     */
    function init() {
        const list = document.getElementById('packageList');
        const emptyState = document.getElementById('emptyState');
        if (!list) return;

        renderList(PACKAGES, list, emptyState);
        initSearch(list, emptyState);
        initCardNavigation(list);
        initBackButton();
    }

    // Run after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
