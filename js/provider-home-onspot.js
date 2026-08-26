/* =========================================================
   HandyHire - On-spot Provider Home JavaScript
   Variant of the Provider Home. Renders the authenticated
   provider's REAL teams from GET /api/worker/teams (replacing
   the previous hardcoded worker dataset). Filter chips, package
   tiles and top navigation behaviour are preserved.
   ========================================================= */

(function () {
    'use strict';

    /**
     * Routes for the filter chips. "On-spot" is the active chip
     * and has no target - the user is already on this page.
     */
    const CHIP_ROUTES = {
        'all': 'provider-home.html',
        'pre-booking': 'provider-home-prebooking.html',
        'near-me': 'provider-home-nearme.html',
        'budget': 'provider-home-budget.html',
    };

    /**
     * Require an authenticated provider.
     * @returns {boolean}
     */
    function requireAuth() {
        if (!(window.HandyHireAPI && typeof window.HandyHireAPI.requireRole === 'function')) {
            window.location.href = 'login.html';
            return false;
        }
        return window.HandyHireAPI.requireRole('worker');
    }

    /**
     * Escape user-supplied text before injecting as HTML.
     * @param {string} str
     * @returns {string}
     */
    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Generate a placeholder avatar data URL from a name.
     * @param {string} name
     * @returns {string}
     */
    function buildAvatar(name) {
        const clean = String(name || '?').trim() || '?';
        const initials = clean
            .split(' ')
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase())
            .slice(0, 2)
            .join('') || '?';

        const hue = Array.from(clean).reduce(
            (sum, ch) => sum + ch.charCodeAt(0),
            0
        ) % 360;

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
     * Render a neutral message into the grid.
     * @param {HTMLElement} container
     * @param {string} text
     */
    function showMessage(container, text) {
        if (!container) return;
        container.innerHTML =
            '<p class="empty-state" style="grid-column: 1 / -1; text-align: center; ' +
            'color: var(--color-text-muted); padding: 32px 0;">' +
            escapeHtml(text) + '</p>';
    }

    /**
     * Render the provider's real teams into the grid.
     * @param {HTMLElement} container
     * @param {Array} teams
     */
    function renderTeams(container, teams) {
        if (!container) return;

        if (!teams || !teams.length) {
            showMessage(container, 'You haven\'t created or joined any teams yet.');
            return;
        }

        container.innerHTML = teams.map(function (team) {
            const count = Array.isArray(team.members) ? team.members.length : 0;
            const roleLabel = team.role === 'creator' ? 'Team creator' : 'Team member';
            const name = team.name || 'Team';

            return `
                <article class="worker-card" tabindex="0"
                         data-team-id="${escapeHtml(String(team.id))}"
                         data-team-name="${escapeHtml(name)}"
                         aria-label="${escapeHtml(name)}, ${escapeHtml(roleLabel)}, ${count} member${count === 1 ? '' : 's'}">
                    <div class="worker-avatar" style="background-image: ${buildAvatar(name)}" aria-hidden="true"></div>
                    <h3 class="worker-name">${escapeHtml(name)}</h3>
                    <p class="worker-profession">${escapeHtml(roleLabel)}</p>
                    <div class="worker-meta">
                        <span class="worker-price">${count} member${count === 1 ? '' : 's'}</span>
                    </div>
                </article>
            `;
        }).join('');
    }

    /**
     * Fetch the provider's teams and render them.
     */
    function loadTeams() {
        const container = document.getElementById('serviceGrid');
        if (!container) return;

        showMessage(container, 'Loading your teams...');

        window.HandyHireAPI.apiFetch('/api/worker/teams')
            .then(function (response) {
                if (response.status === 401) {
                    window.HandyHireAPI.clearAuth();
                    window.location.href = 'login.html';
                    return;
                }
                if (response.status === 403) {
                    showMessage(container, 'You do not have provider access to this page.');
                    return;
                }
                if (!response.ok) {
                    showMessage(container, 'Unable to load your teams. Please try again.');
                    return;
                }
                return response.json();
            })
            .then(function (teams) {
                if (!teams) return;
                renderTeams(container, teams);
            })
            .catch(function () {
                showMessage(container, 'Network error. Please check your connection and try again.');
            });
    }

    /**
     * Wire up team-card clicks/keys to open the team page.
     */
    function initTeamCards() {
        const grid = document.getElementById('serviceGrid');
        if (!grid) return;

        function openTeam(card) {
            const id = card.getAttribute('data-team-id');
            const name = card.getAttribute('data-team-name');
            if (!id) return;
            try {
                sessionStorage.setItem('handyhire.selectedTeamId', id);
                sessionStorage.setItem('handyhire.selectedTeam', name || '');
                sessionStorage.setItem('handyhire.provider.previousPage', 'provider-home-onspot.html');
            } catch (e) {}
            window.location.href = 'provider-team-page.html';
        }

        grid.addEventListener('click', function (event) {
            const card = event.target.closest('.worker-card');
            if (!card || !grid.contains(card)) return;
            openTeam(card);
        });

        grid.addEventListener('keydown', function (event) {
            const card = event.target.closest('.worker-card');
            if (!card || !grid.contains(card)) return;
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openTeam(card);
            }
        });
    }

    /**
     * Wire up the filter chips so they navigate to the right page
     * based on the centralized CHIP_ROUTES map.
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
     * Wire up the top navigation tabs.
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
     * Make the package tiles keyboard-accessible (Space).
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
     * Initialize the on-spot home page.
     */
    function init() {
        if (!requireAuth()) return;
        loadTeams();
        initFilterChips();
        initTeamCards();
        initPackageTiles();
        initTopNav();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
