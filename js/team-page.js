/* =========================================================
   HandyHire - Team Page JavaScript
   Shows the WHOLE-TEAM details for the team selected on
   team-package.html (read from sessionStorage). Renders the
   team header, a vertical list of team members, an expand
   control, and a primary "BOOK WHOLE TEAM" CTA that routes
   to booking.html. Clicking an individual member opens the
   team-member.html details view in view-only mode.
   ========================================================= */

(function () {
    'use strict';

    /**
     * Holds the team currently being shown. Resolved from
     * the backend via GET /api/teams/{team_id}.
     */
    let TEAM = null;

    /**
     * Number of members shown before the arrow button is
     * needed; the rest are tagged as "extra" and revealed
     * on expand.
     */
    const VISIBLE_BY_DEFAULT = 3;

    /**
     * Read the selected team ID from sessionStorage.
     * Falls back to the team name for backward compatibility.
     * @returns {string|null}
     */
    function readSelectedTeamId() {
        try {
            const id = sessionStorage.getItem('handyhire.selectedTeamId');
            if (id) return id;
        } catch (e) {}
        try {
            const name = sessionStorage.getItem('handyhire.selectedTeam');
            if (name) return name;
        } catch (e) {}
        return null;
    }

    /**
     * Persist the selected team so subsequent pages
     * (booking.html, team-member.html) can read it.
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
            // Ignore.
        }
    }

    /**
     * Read a member's details from sessionStorage when the
     * user clicks on a member card. Returns null if nothing
     * is stored.
     * @returns {Object|null}
     */
    function readSelectedMember() {
        try {
            const raw = sessionStorage.getItem('handyhire.selectedMember');
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Convert a worker name into a URL-safe slug used by
     * team-member.js. Kept here so the team-page navigation
     * can build the same slug the details page expects.
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
     * Require an authenticated customer.
     * @returns {boolean}
     */
    function requireAuth() {
        if (!(window.HandyHireAPI && typeof window.HandyHireAPI.requireRole === 'function')) {
            window.location.href = 'login.html';
            return false;
        }
        return window.HandyHireAPI.requireRole('customer');
    }

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

        return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
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
     * Render the team avatar and name into the page header.
     * Hides the rating block because the backend does not
     * provide a team-level rating.
     * @param {Object} team
     */
    function renderTeamHeader(team) {
        const avatar = document.getElementById('teamAvatar');
        const name = document.getElementById('teamName');
        const rating = document.getElementById('teamRating');

        if (avatar) avatar.style.backgroundImage = buildAvatar(team.name);
        if (name) name.textContent = team.name;
        if (rating) {
            rating.hidden = true;
        }
    }

    /**
     * Render a single member card.
     * @param {Object} member
     * @param {boolean} isExtra  true if the card is hidden by default
     * @returns {string} HTML string
     */
    function renderMember(member, isExtra) {
        const extraClass = isExtra ? ' is-extra' : '';
        const name = member.full_name || member.name || 'Worker';
        const occupation = member.profession || member.role || 'Team member';

        return `
            <li>
                <article class="member-card${extraClass}" tabindex="0"
                         data-worker-id="${escapeHtml(String(member.worker_id))}"
                         data-name="${escapeHtml(name)}"
                         data-occupation="${escapeHtml(occupation)}"
                         aria-label="View details for ${escapeHtml(name)}, ${escapeHtml(occupation)}">
                    <div class="member-avatar" style="background-image: ${buildAvatar(name)}" aria-hidden="true"></div>
                    <div class="member-text">
                        <p class="member-name">${escapeHtml(name)}</p>
                        <p class="member-occupation">${escapeHtml(occupation)}</p>
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

        if (!TEAM || !Array.isArray(TEAM.members) || !TEAM.members.length) {
            list.innerHTML = '';
            return;
        }

        const html = TEAM.members
            .map((m, index) => renderMember(m, index >= VISIBLE_BY_DEFAULT))
            .join('');

        list.innerHTML = html;
    }

    /**
     * Wire up click + keyboard activation on member cards.
     * Clicking a member MUST NOT trigger any booking flow -
     * it only opens the team-member.html (team member details)
     * page in view-only mode so the details page can:
     *   - resolve the correct member record via stored worker_id
     *   - route its Back control back to this Team Page
     */
    function initMemberNavigation() {
        const list = document.getElementById('membersList');
        if (!list) return;

        function openMember(card) {
            const workerId = card.getAttribute('data-worker-id') || '';
            const name = card.getAttribute('data-name') || '';
            const occupation = card.getAttribute('data-occupation') || '';
            const slug = makeSlug(name);

            const member = {
                worker_id: workerId ? Number(workerId) : null,
                name: name,
                occupation: occupation,
                team: TEAM ? TEAM.name : '',
                slug: slug,
            };

            try {
                sessionStorage.setItem('handyhire.selectedMember',
                    JSON.stringify(member));
                if (workerId) sessionStorage.setItem('handyhire.selectedWorkerSlug', slug);
            } catch (e) {
                // Ignore storage errors.
            }

            try {
                sessionStorage.setItem('handyhire.customer.previousPage', 'team-page.html');
            } catch (e) {}
            window.location.href = 'team-member.html';
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
     * the customer to booking.html with the entire team
     * marked as the booking subject.
     */
    function initBookWholeTeam() {
        const btn = document.getElementById('bookWholeTeamBtn');
        if (!btn) return;

        btn.addEventListener('click', function () {
            try {
                sessionStorage.setItem('handyhire.selectedTeam', TEAM.name);
                if (TEAM.id != null) {
                    sessionStorage.setItem('handyhire.selectedTeamId', String(TEAM.id));
                }
                sessionStorage.setItem('handyhire.bookingMode', 'team');
                sessionStorage.setItem('handyhire.customer.previousPage', 'team-page.html');
            } catch (e) {
                // Ignore.
            }
            window.location.href = 'booking.html';
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

        const extras = TEAM && Array.isArray(TEAM.members)
            ? TEAM.members.length - VISIBLE_BY_DEFAULT
            : 0;
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
     * Show a message in the members list.
     * @param {string} text
     */
    function showMessage(text) {
        const list = document.getElementById('membersList');
        if (!list) return;
        list.innerHTML =
            '<li><p class="empty-state" style="grid-column: 1 / -1; text-align: center; ' +
            'color: var(--color-text-muted); padding: 32px 0;">' +
            escapeHtml(text) + '</p></li>';
    }

    /**
     * Fetch the team from the backend and render it.
     */
    async function loadTeam() {
        const teamId = readSelectedTeamId();
        if (!teamId) {
            showMessage('No team selected. Please select a team first.');
            return;
        }

        showMessage('Loading team...');

        if (!(window.HandyHireAPI && typeof window.HandyHireAPI.apiFetch === 'function')) {
            showMessage('Unable to load teams. Please try again.');
            return;
        }

        try {
            const resp = await window.HandyHireAPI.apiFetch('/api/teams/' + encodeURIComponent(String(teamId)));

            if (resp.status === 401) {
                window.HandyHireAPI.clearAuth();
                window.location.href = 'login.html';
                return;
            }
            if (resp.status === 403) {
                showMessage('You do not have access to this team.');
                return;
            }
            if (resp.status === 404) {
                showMessage('Team not found.');
                return;
            }
            if (!resp.ok) {
                showMessage('Unable to load team. Please try again.');
                return;
            }

            const team = await resp.json();

            TEAM = {
                id: team.id,
                name: team.name || '',
                category: team.category || '',
                description: team.description || '',
                members: (team.members || []).map(function (m) {
                    return {
                        worker_id: m.worker_id,
                        full_name: m.full_name,
                        profession: m.profession,
                        role: m.role,
                    };
                }),
            };

            persistSelectedTeam(TEAM.name, TEAM.id);

            renderTeamHeader(TEAM);
            renderMembers();
            initMemberNavigation();
            initBookWholeTeam();
            initExpand();
        } catch (e) {
            showMessage('Network error. Please check your connection and try again.');
        }
    }

    /**
     * Initialize the Team page.
     */
    function init() {
        if (!requireAuth()) return;
        loadTeam();
        initBackButton();
    }

    // Run after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

