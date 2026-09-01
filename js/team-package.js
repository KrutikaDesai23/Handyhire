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
     * Fetched team data from the backend.
     */
    let allTeams = [];

    /**
     * Map a backend team object to the shape consumed by the
     * existing card renderer.
     */
    function mapTeamToCard(team) {
        const memberNames = (team.members || [])
            .map(function (m) { return m.full_name || m.profession || 'Team member'; });

        return {
            id: team.id,
            name: team.name || '',
            category: team.category || '',
            description: team.description || '',
            members: memberNames,
            size: memberNames.length,
            rating: null,
            priceLabel: null,
        };
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
     * Build a "â˜… â˜… â˜… â˜… â˜…" style stars string for a rating.
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
     * Render a single WHOLE-TEAM package card as an <li>.
     * No individual worker rates; the card represents the
     * entire team and exposes a "Book Whole Team" CTA.
     * @param {Object} pkg
     * @returns {string} HTML string
     */
    function renderCard(pkg) {
        const memberBullets = pkg.members
            .map((m) => `<li>${escapeHtml(m)}</li>`)
            .join('');

        const labelSummary = [
            formatSize(pkg.size),
            escapeHtml(pkg.category),
        ].join(' &middot; ');

        const ratingHtml = pkg.rating != null
            ? `<div class="package-rating" aria-label="Team rated ${Number(pkg.rating).toFixed(1)} out of 5">
                    <span class="stars" aria-hidden="true">${buildStars(pkg.rating)}</span>
                    <span class="rating-value">${Number(pkg.rating).toFixed(1)}</span>
               </div>`
            : '';

        const priceHtml = pkg.priceLabel
            ? `<div class="package-price-row">
                    <span class="package-price-label">${escapeHtml(pkg.priceLabel)}</span>
               </div>`
            : '';

        return `
            <li>
                <article class="package-card" tabindex="0"
                         data-name="${escapeHtml(pkg.name)}"
                         data-team-id="${escapeHtml(String(pkg.id))}"
                         aria-label="${escapeHtml(pkg.name)} team package, ${labelSummary}">
                    <div class="package-avatar" style="background-image: ${buildAvatar(pkg.name)}" aria-hidden="true"></div>
                    <div class="package-text">
                        <p class="package-name">${escapeHtml(pkg.name)}</p>
                        <p class="package-description">${escapeHtml(pkg.description)}</p>
                        ${ratingHtml}
                        <p class="package-section-label">Team includes:</p>
                        <ul class="package-members">
                            ${memberBullets}
                        </ul>
                        ${priceHtml}
                        <button type="button"
                                class="package-book-cta"
                                data-target-team="${escapeHtml(pkg.name)}">
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
     * @param {string} query
     * @param {string} teamSize "all" | "2" | "3" | "4" | "5"
     * @returns {Array}
     */
    function filterPackages(query, teamSize) {
        const q = String(query || '').trim().toLowerCase();
        const sizeFilter = String(teamSize || 'all');

        return allTeams.filter(function (pkg) {
            const matchesText = !q
                || pkg.name.toLowerCase().includes(q)
                || pkg.category.toLowerCase().includes(q);

            const matchesSize = (
                sizeFilter === 'all' ||
                (sizeFilter === '5' ? pkg.size >= 5 : pkg.size === Number(sizeFilter))
            );

            return matchesText && matchesSize;
        });
    }

    /**
     * Wire up the search input and Team Size select so the
     * list updates as either changes.
     */
    function initFilters(container, emptyState) {
        const input = document.getElementById('packageSearch');
        const select = document.getElementById('teamSizeSelect');
        if (!input && !select) return;

        function update() {
            const q = input ? input.value : '';
            const size = select ? select.value : 'all';
            const filtered = filterPackages(q, size);
            if (emptyState && !filtered.length) {
                emptyState.textContent = 'No packages match your filters.';
            }
            renderList(filtered, container, emptyState);
        }

        if (input) input.addEventListener('input', update);
        if (select) select.addEventListener('change', update);
    }

    /**
     * Persist the selected whole team so the next page
     * (team-page.html, booking.html) can read it and show
     * "Booking: <Team Name>" instead of a single worker.
     * @param {string} teamName
     * @param {number|string|null} teamId
     */
    function persistSelectedTeam(teamName, teamId) {
        try {
            sessionStorage.setItem('handyhire.selectedTeam', teamName);
            if (teamId != null) {
                sessionStorage.setItem('handyhire.selectedTeamId', String(teamId));
            }
        } catch (e) {
            // Ignore storage errors (private mode etc.).
        }
    }

    /**
     * Resolve the team name from the clicked element. The
     * user can activate the card body or the "Book Whole
     * Team" button inside it; both should send the same
     * team name forward.
     * @param {HTMLElement} target
     * @param {HTMLElement} container
     * @returns {string|null}
     */
    function resolveTeamName(target, container) {
        const card = target.closest('.package-card');
        if (!card || !container.contains(card)) return null;
        return card.getAttribute('data-name') || null;
    }

    /**
     * Wire up click + Enter / Space on every package card
     * AND on the "Book Whole Team" CTA inside each card.
     * Both routes select the whole team and forward to
     * team-page.html - never to booking.html, never to
     * worker-profile.html, never to multitasking-package.html.
     */
    function initCardNavigation(container) {
        if (!container) return;

        function navigate(teamName, teamId) {
            if (!teamName) return;
            persistSelectedTeam(teamName, teamId);
            try {
                sessionStorage.setItem('handyhire.customer.previousPage', 'team-package.html');
            } catch (e) {}
            window.location.href = 'team-page.html';
        }

        container.addEventListener('click', function (event) {
            // Activate via card body or via the CTA button.
            const cta = event.target.closest('.package-book-cta');
            if (cta && container.contains(cta)) {
                const name = cta.getAttribute('data-target-team')
                    || resolveTeamName(cta, container);
                const card = cta.closest('.package-card');
                const teamId = card ? card.getAttribute('data-team-id') : null;
                navigate(name, teamId);
                return;
            }
            const card = event.target.closest('.package-card');
            if (!card || !container.contains(card)) return;
            navigate(card.getAttribute('data-name'), card.getAttribute('data-team-id'));
        });

        container.addEventListener('keydown', function (event) {
            if (event.key !== 'Enter' && event.key !== ' ') return;

            const cta = event.target.closest('.package-book-cta');
            if (cta && container.contains(cta)) {
                event.preventDefault();
                const name = cta.getAttribute('data-target-team')
                    || resolveTeamName(cta, container);
                const card = cta.closest('.package-card');
                const teamId = card ? card.getAttribute('data-team-id') : null;
                navigate(name, teamId);
                return;
            }
            const card = event.target.closest('.package-card');
            if (!card || !container.contains(card)) return;
            event.preventDefault();
            navigate(card.getAttribute('data-name'), card.getAttribute('data-team-id'));
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
     * Fetch teams from the backend and render them.
     */
    async function loadTeams() {
        const list = document.getElementById('packageList');
        const emptyState = document.getElementById('emptyState');
        if (!list) return;

        if (emptyState) {
            emptyState.textContent = 'Loading teams...';
            emptyState.hidden = false;
        }
        list.innerHTML = '';

        if (!(window.HandyHireAPI && typeof window.HandyHireAPI.apiFetch === 'function')) {
            if (emptyState) {
                emptyState.textContent = 'Unable to load teams. Please try again.';
                emptyState.hidden = false;
            }
            return;
        }

        try {
            const resp = await window.HandyHireAPI.apiFetch('/api/teams');

            if (!resp.ok) {
                throw new Error('API returned ' + resp.status);
            }

            const data = await resp.json();
            allTeams = Array.isArray(data) ? data.map(mapTeamToCard) : [];

            if (!allTeams.length) {
                if (emptyState) {
                    emptyState.textContent = 'No teams available.';
                    emptyState.hidden = false;
                }
                return;
            }

            if (emptyState) emptyState.hidden = true;
            renderList(allTeams, list, emptyState);
        } catch (e) {
            if (emptyState) {
                emptyState.textContent = 'Unable to load teams. Please try again.';
                emptyState.hidden = false;
            }
        }
    }

    /**
     * Initialize the Team Packages page.
     */
    function init() {
        if (!(window.HandyHireAPI && window.HandyHireAPI.requireRole('customer'))) return;
        const list = document.getElementById('packageList');
        const emptyState = document.getElementById('emptyState');
        if (!list) return;

        initFilters(list, emptyState);
        initCardNavigation(list);
        initBackButton();
        loadTeams();
    }

    // Run after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
