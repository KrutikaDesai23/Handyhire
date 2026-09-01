/* =========================================================
   HandyHire - Team Page JavaScript
   Shows the WHOLE-TEAM details for the team selected on
   team-package.html (read from URL query or sessionStorage).
   Renders the team header, a vertical list of team members,
   an expand control, and a primary "BOOK WHOLE TEAM" CTA
   that routes to booking.html. Clicking an individual member
   opens the team-member.html details view.
   ========================================================= */

(function () {
    'use strict';

    /**
     * Number of members shown before the arrow button is
     * needed; the rest are tagged as "extra" and revealed
     * on expand.
     */
    const VISIBLE_BY_DEFAULT = 3;

    /**
     * Holds the team/package currently being shown.
     */
    let TEAM = null;

    /**
     * Generate a placeholder avatar data URL so the team
     * header and member cards render meaningfully without
     * external image dependencies.
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
     * Read package_id from URL query params first,
     * then fall back to sessionStorage.
     * @returns {string|null}
     */
    function readPackageId() {
        try {
            const params = new URLSearchParams(window.location.search);
            const fromUrl = params.get('package_id');
            if (fromUrl) return String(fromUrl).trim();
        } catch (e) {
            // Ignore URL errors.
        }
        try {
            const stored = sessionStorage.getItem('handyhire.selectedPackage');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed && parsed.id) return String(parsed.id);
            }
        } catch (e) {
            // Ignore storage errors.
        }
        return null;
    }

    /**
     * Persist the selected package ID for downstream pages.
     * @param {Object} pkg
     */
    function persistSelectedPackage(pkg) {
        try {
            sessionStorage.setItem('handyhire.selectedPackage', JSON.stringify({
                id: pkg.id,
                name: pkg.name,
            }));
        } catch (e) {
            // Ignore.
        }
    }

    /**
     * Render the team avatar, name, and rating into the
     * page header.
     */
    function renderTeamHeader() {
        const avatar = document.getElementById('teamAvatar');
        const name = document.getElementById('teamName');
        const rating = document.getElementById('teamRating');
        const priceEl = document.getElementById('teamPrice');
        const durationEl = document.getElementById('teamDuration');
        const locationEl = document.getElementById('teamLocation');
        const availabilityEl = document.getElementById('teamAvailability');
        const descriptionEl = document.getElementById('teamDescription');

        if (avatar) avatar.style.backgroundImage = buildAvatar(TEAM.name);
        if (name) name.textContent = TEAM.name;
        if (descriptionEl) descriptionEl.textContent = TEAM.description || '';
        if (rating) {
            rating.setAttribute('aria-label',
                `Team rated ${Number(TEAM.rating || 0).toFixed(1)} out of 5`);
            rating.innerHTML =
                `<span class="stars" aria-hidden="true">${buildStars(TEAM.rating || 0)}</span>` +
                `<span class="rating-value">${Number(TEAM.rating || 0).toFixed(1)}</span>`;
        }
        if (priceEl) {
    priceEl.textContent =
        '\u20B9' +
        Number(TEAM.price || 0).toLocaleString() +
        ' / hour';
}
        if (durationEl) durationEl.textContent = TEAM.duration || '--';
        if (locationEl) locationEl.textContent = TEAM.location || '--';
        if (availabilityEl) availabilityEl.textContent = TEAM.availability || '--';
    }

    /**
     * Render a single member card.
     * @param {Object} worker
     * @param {number} index
     * @param {boolean} isExtra  true if the card is hidden by default
     * @returns {string} HTML string
     */
    function renderMember(worker, index, isExtra) {
        const extraClass = isExtra ? ' is-extra' : '';
        const name = worker.full_name || 'Worker';
        const profession = worker.profession || 'Team Member';
        return `
            <li>
                <article class="member-card${extraClass}" tabindex="0"
                         data-worker-id="${escapeHtml(String(worker.worker_id || ''))}"
                         data-name="${escapeHtml(name)}"
                         data-profession="${escapeHtml(profession)}"
                         aria-label="View details for ${escapeHtml(name)}, ${escapeHtml(profession)}">
                    <div class="member-avatar" style="background-image: ${buildAvatar(name)}" aria-hidden="true"></div>
                    <div class="member-text">
                        <p class="member-name">${escapeHtml(name)}</p>
                        <p class="member-occupation">${escapeHtml(profession)}</p>
                    </div>
                </article>
            </li>
        `.trim();
    }

    /**
     * Render the full member list. The first VISIBLE_BY_DEFAULT
     * members are shown immediately; the rest are tagged with
     * the `is-extra` class so they stay hidden until the
     * expand arrow is pressed.
     */
    function renderMembers() {
        const list = document.getElementById('membersList');
        if (!list) return;

        const workers = Array.isArray(TEAM.workers) ? TEAM.workers : [];
        const html = workers
            .map((w, index) => renderMember(w, index, index >= VISIBLE_BY_DEFAULT))
            .join('');

        list.innerHTML = html;

        const expandBtn = document.getElementById('expandBtn');
        if (expandBtn) {
            const extras = workers.length - VISIBLE_BY_DEFAULT;
            expandBtn.hidden = extras <= 0;
        }
    }

    /**
     * Wire up click + keyboard activation on member cards.
     * Clicking a member opens team-member.html in view-only mode.
     */
    function initMemberNavigation() {
        const list = document.getElementById('membersList');
        if (!list) return;

        function openMember(card) {
            const workerId = card.getAttribute('data-worker-id') || '';
            const name = card.getAttribute('data-name') || '';
            const profession = card.getAttribute('data-profession') || '';

            try {
                sessionStorage.setItem('handyhire.selectedMember', JSON.stringify({
                    worker_id: workerId,
                    name: name,
                    profession: profession,
                    team: TEAM.name,
                }));
            } catch (e) {
                // Ignore storage errors.
            }

            const packageId = readPackageId();
            const url = 'team-member.html'
                + '?worker_id=' + encodeURIComponent(workerId)
                + '&package_id=' + encodeURIComponent(packageId || '');
            try {
                sessionStorage.setItem('handyhire.customer.previousPage', 'team-page.html');
            } catch (e) {}
            window.location.href = url;
        }

        list.addEventListener('click', function (event) {
            const card = event.target.closest('.member-card');
            if (!card || !list.contains(card)) return;
            openMember(card);
        });

        list.addEventListener('keydown', function (event) {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            const card = event.target.closest('.member-card');
            if (!card || !list.contains(card)) return;
            event.preventDefault();
            openMember(card);
        });
    }

    /**
     * Wire up the primary "BOOK WHOLE TEAM" CTA so it routes
     * the customer to booking.html with the package ID.
     */
    function initBookWholeTeam() {
        const btn = document.getElementById('bookWholeTeamBtn');
        if (!btn) return;

        btn.addEventListener('click', function () {
            const packageId = readPackageId();
            if (!packageId) return;
            try {
                sessionStorage.setItem('handyhire.selectedPackage', JSON.stringify({
                    id: TEAM.id,
                    name: TEAM.name,
                }));
                sessionStorage.setItem('handyhire.bookingMode', 'team');
                sessionStorage.setItem('handyhire.customer.previousPage', 'team-page.html');
            } catch (e) {
                // Ignore.
            }
            window.location.href = 'booking.html?package_id=' + encodeURIComponent(packageId) + '&booking_mode=team';
        });
    }

    /**
     * Wire up the expand arrow. Pressing it reveals the
     * remaining member cards and toggles its own state so
     * it can be used as a collapse control too.
     */
    function initExpand() {
        const btn = document.getElementById('expandBtn');
        const list = document.getElementById('membersList');
        if (!btn || !list) return;

        const workers = Array.isArray(TEAM.workers) ? TEAM.workers : [];
        const extras = workers.length - VISIBLE_BY_DEFAULT;
        if (extras <= 0) {
            btn.hidden = true;
            return;
        }

        btn.addEventListener('click', function () {
            const expanded = list.classList.toggle('is-expanded');
            btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            btn.setAttribute('aria-label',
                expanded ? 'Show fewer team members' : 'Show more team members');
        });
    }

    /**
      * Wire the Back button to the Team Package catalogue
      * deterministically so it never reopens the Team
      * details page via browser-history navigation.
      */
    function initBackButton() {
        const back = document.getElementById('backLink');
        if (!back) return;
        back.addEventListener('click', function (event) {
            event.preventDefault();
            window.location.href = 'team-package.html';
        });
    }

    /**
     * Show an error state on the page.
     */
    function showError(message) {
        const nameEl = document.getElementById('teamName');
        const descEl = document.getElementById('teamDescription');
        if (nameEl) nameEl.textContent = 'Error';
        if (descEl) descEl.textContent = message;
    }

    /**
     * Initialize the Team page.
     */
    function init() {
        if (!(window.HandyHireAPI && window.HandyHireAPI.requireRole('customer'))) return;

        const packageId = readPackageId();
        if (!packageId) {
            showError('No package selected. Please go back and choose a package.');
            return;
        }

        const api = getApi();
        if (!api) {
            showError('Unable to load package details. Please try again later.');
            return;
        }

        api.apiFetch('/api/packages/' + encodeURIComponent(packageId))
            .then(function (response) {
                if (response.status === 401) {
                    api.clearAuth();
                    window.location.href = 'login.html';
                    return null;
                }
                if (!response.ok) throw new Error('Package not found');
                return response.json();
            })
            .then(function (pkg) {
                if (!pkg) return;
                if (pkg.package_type !== 'team') {
                    showError('This is not a team package.');
                    return;
                }
                TEAM = {
                    id: pkg.id,
                    name: pkg.name,
                    description: pkg.description,
                    rating: 0,
                    price: pkg.price,
                    duration: pkg.duration,
                    location: pkg.location,
                    availability: pkg.availability,
                    workers: Array.isArray(pkg.workers) ? pkg.workers : [],
                };
                persistSelectedPackage(TEAM);
                renderTeamHeader();
                renderMembers();
                initMemberNavigation();
                initBookWholeTeam();
                initExpand();
                initBackButton();
            })
            .catch(function () {
                showError('Unable to load package details. Please go back and try again.');
            });
    }

    // Run after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
