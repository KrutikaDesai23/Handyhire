/* =========================================================
   HandyHire - Team Page JavaScript
   Shows the WHOLE-TEAM details for the team selected on
   team-package.html (read from sessionStorage). Renders the
   team header, a vertical list of team members, an expand
   control, and a primary "BOOK WHOLE TEAM" CTA that routes
   to booking.html. Clicking an individual member opens the
   job-hire.html details view in view-only mode
   (?worker=<slug>&source=team) - it MUST NOT trigger any
   booking flow.
   ========================================================= */

(function () {
    'use strict';

    /**
     * Full team catalog. The team selected on team-package.html
     * is matched by name. A fallback team is shown when no
     * selection is stored.
     */
    const TEAM_CATALOG = {
        'BuildRight Crew': {
            name: 'BuildRight Crew',
            rating: 4.8,
            category: 'Construction',
            members: [
                { name: 'Rushda Kalghatgi', occupation: 'Laborer' },
                { name: 'Anita Sharma',     occupation: 'Carpenter' },
                { name: 'Suresh Patel',     occupation: 'Electrician' },
                { name: 'Mohan Das',        occupation: 'Mason' },
            ],
        },
        'Home Renovation Team': {
            name: 'Home Renovation Team',
            rating: 4.7,
            category: 'Home Renovation',
            members: [
                { name: 'Ravi Kumar',   occupation: 'Carpenter' },
                { name: 'Priya Singh',  occupation: 'Painter' },
                { name: 'Lata Verma',   occupation: 'Electrician' },
            ],
        },
        'FixIt Squad': {
            name: 'FixIt Squad',
            rating: 4.6,
            category: 'Repair & Maintenance',
            members: [
                { name: 'Ravi Kumar',  occupation: 'Plumber' },
                { name: 'Anita Sharma', occupation: 'Electrician' },
                { name: 'Arjun Mehta',  occupation: 'Handyman' },
            ],
        },
        'CleanHome Team': {
            name: 'CleanHome Team',
            rating: 4.9,
            category: 'Cleaning',
            members: [
                { name: 'Priya Singh',  occupation: 'Cleaner' },
                { name: 'Neha Iyer',    occupation: 'Pest Control' },
                { name: 'Asha Verma',   occupation: 'Helper' },
                { name: 'Rina Das',     occupation: 'Helper' },
                { name: 'Pooja Nair',   occupation: 'Helper' },
            ],
        },
        'PowerGrid Unit': {
            name: 'PowerGrid Unit',
            rating: 4.5,
            category: 'Electrical',
            members: [
                { name: 'Anita Sharma', occupation: 'Electrician' },
                { name: 'Arjun Mehta',  occupation: 'Helper' },
            ],
        },
        'FreshPaint Crew': {
            name: 'FreshPaint Crew',
            rating: 4.6,
            category: 'Painting',
            members: [
                { name: 'Mohan Das',     occupation: 'Painter' },
                { name: 'Pooja Nair',    occupation: 'Helper' },
                { name: 'Suresh Patel',  occupation: 'Carpenter' },
            ],
        },
    };

    /**
     * Fallback team when no selection is stored (e.g. when
     * the page is opened directly).
     */
    const DEFAULT_TEAM = 'BuildRight Crew';

    /**
     * Read the selected team name from sessionStorage.
     * Falls back to DEFAULT_TEAM when no selection exists.
     * @returns {string}
     */
    function readSelectedTeam() {
        try {
            const stored = sessionStorage.getItem('handyhire.selectedTeam');
            if (stored && TEAM_CATALOG[stored]) return stored;
        } catch (e) {
            // Ignore storage errors.
        }
        return DEFAULT_TEAM;
    }

    /**
     * Persist the selected team so subsequent pages
     * (booking.html) can read it.
     * @param {string} teamName
     */
    function persistSelectedTeam(teamName) {
        try {
            sessionStorage.setItem('handyhire.selectedTeam', teamName);
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
     * job-hire.js (and the customer home JS files).
     * Kept here so the team-page navigation can build the
     * same slug the details page expects.
     * @param {string} name
     * @returns {string}
     */
    function makeSlug(name) {
        return String(name || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    'use strict';

    /**
     * Number of members shown before the arrow button is
     * needed; the rest are tagged as "extra" and revealed
     * on expand.
     */
    const VISIBLE_BY_DEFAULT = 3;

    /**
     * Holds the team currently being shown. Resolved at
     * init() from sessionStorage (or the default team).
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

        return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
    }

    /**
     * Build a "â˜… â˜… â˜… â˜… â˜†" style stars string for a given rating.
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
     * Render the team avatar, name, and rating into the
     * page header.
     */
    function renderTeamHeader() {
        const avatar = document.getElementById('teamAvatar');
        const name = document.getElementById('teamName');
        const rating = document.getElementById('teamRating');

        if (avatar) avatar.style.backgroundImage = buildAvatar(TEAM.name);
        if (name) name.textContent = TEAM.name;
        if (rating) {
            rating.setAttribute('aria-label',
                `Team rated ${TEAM.rating.toFixed(1)} out of 5`);
            rating.innerHTML =
                `<span class="stars" aria-hidden="true">${buildStars(TEAM.rating)}</span>` +
                `<span class="rating-value">${TEAM.rating.toFixed(1)}</span>`;
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
        return `
            <li>
                <article class="member-card${extraClass}" tabindex="0"
                         data-name="${escapeHtml(member.name)}"
                         data-occupation="${escapeHtml(member.occupation)}"
                         aria-label="View details for ${escapeHtml(member.name)}, ${escapeHtml(member.occupation)}">
                    <div class="member-avatar" style="background-image: ${buildAvatar(member.name)}" aria-hidden="true"></div>
                    <div class="member-text">
                        <p class="member-name">${escapeHtml(member.name)}</p>
                        <p class="member-occupation">${escapeHtml(member.occupation)}</p>
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

        const html = TEAM.members
            .map((m, index) => renderMember(m, index >= VISIBLE_BY_DEFAULT))
            .join('');

        list.innerHTML = html;
    }

    /**
     * Wire up click + keyboard activation on member cards.
     * Clicking a member MUST NOT trigger any booking flow -
     * it only opens the job-hire.html (worker details) page
     * in view-only mode (source=team) so the details page
     * can:
     *   - resolve the correct member record via ?worker=<slug>
     *   - hide the Book Now CTA
     *   - route its Back control back to this Team Page
     */
    function initMemberNavigation() {
        const list = document.getElementById('membersList');
        if (!list) return;

        function openMember(card) {
            const name = card.getAttribute('data-name') || '';
            const occupation = card.getAttribute('data-occupation') || '';
            const slug = makeSlug(name);

            const member = {
                name: name,
                occupation: occupation,
                team: TEAM.name,
                slug: slug,
            };
            try {
                sessionStorage.setItem('handyhire.selectedMember',
                    JSON.stringify(member));
                sessionStorage.setItem('handyhire.selectedWorkerSlug', slug);
            } catch (e) {
                // Ignore storage errors.
            }

            // View-only details page. source=team tells
            // job-hire.js to hide Book Now and to wire
            // its Back control back to this team page.
            const url = 'job-hire.html?worker='
                + encodeURIComponent(slug)
                + '&source=team';
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
     * the customer to booking.html with the entire team
     * marked as the booking subject.
     */
    function initBookWholeTeam() {
        const btn = document.getElementById('bookWholeTeamBtn');
        if (!btn) return;

        btn.addEventListener('click', function () {
            try {
                sessionStorage.setItem('handyhire.selectedTeam', TEAM.name);
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

        // If there are no extras, the button has nothing to
        // reveal; hide it so it doesn't look broken.
        const extras = TEAM.members.length - VISIBLE_BY_DEFAULT;
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
     * Initialize the Team page.
     */
    function init() {
        if (!(window.HandyHireAPI && window.HandyHireAPI.requireRole('customer'))) return;
        const teamName = readSelectedTeam();
        persistSelectedTeam(teamName);
        TEAM = TEAM_CATALOG[teamName] || TEAM_CATALOG[DEFAULT_TEAM];

        renderTeamHeader();
        renderMembers();
        initMemberNavigation();
        initBookWholeTeam();
        initExpand();
        initBackButton();
    }

    // Run after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
