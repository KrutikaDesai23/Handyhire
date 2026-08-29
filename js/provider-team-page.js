/* =========================================================
   HandyHire - Provider Team Page JavaScript
   Loads the authenticated provider's REAL team from
   GET /api/teams/{team_id} and enriches every member with
   GET /api/workers/{worker_id}. The old TEAM_CATALOG and
   DEFAULT_TEAM are removed as the normal data source.
   ========================================================= */

(function () {
    'use strict';

    const VISIBLE_BY_DEFAULT = 3;
    let TEAM = null;

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
            <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'>
                <defs>
                    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
                        <stop offset='0%' stop-color='hsl(${hue}, 35%, 70%)'/>
                        <stop offset='100%' stop-color='hsl(${hue}, 40%, 55%)'/>
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
     * Read the selected team ID from sessionStorage,
     * falling back to the selected team name.
     * @returns {string|null}
     */
    function readTeamId() {
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
function readSelectedPackage() {
    try {
        const raw =
            sessionStorage.getItem(
                'handyhire.selectedTeamPackage'
            );

        if (!raw) {
            return null;
        }

        const parsed =
            JSON.parse(raw);

        return (
            parsed &&
            typeof parsed === 'object'
        )
            ? parsed
            : null;

    } catch (e) {
        return null;
    }
}
    /**
     * Render a neutral message into the members list.
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
     * Render the team header using real backend data.
     * @param {Object} team
     */
    function renderTeamHeader(team) {
        const avatar = document.getElementById('teamAvatar');
        if (avatar) avatar.style.backgroundImage = buildAvatar(team.name);

        const nameEl = document.getElementById('teamName');
        if (nameEl) {
            let label = team.name || 'Team';
            if (team.creator_name) label += ' \u00b7 by ' + team.creator_name;
            nameEl.textContent = label;
        }

        const ratingEl = document.getElementById('teamRating');
        if (ratingEl) {
            const count = Array.isArray(team.members) ? team.members.length : 0;
            ratingEl.innerHTML = '<span class="rating-value">' + count + ' member' + (count === 1 ? '' : 's') + '</span>';
            ratingEl.setAttribute('aria-label', count + ' members');
        }
    }

    /**
     * Render a single member card from enriched backend data.
     * @param {Object} member
     * @param {boolean} isExtra
     * @returns {string}
     */
    function renderMember(member, isExtra) {
        const extraClass = isExtra ? ' is-extra' : '';
        const name = member.full_name || member.name || 'Worker';
        const occupation = member.profession || member.role || 'Team member';
        const avatarStyle = member.profile_image
            ? 'url("' + member.profile_image + '")'
            : buildAvatar(name);

        return `
            <li>
                <article class="member-card${extraClass}" tabindex="0"
                         data-worker-id="${escapeHtml(String(member.worker_id))}"
                         data-name="${escapeHtml(name)}"
                         data-occupation="${escapeHtml(occupation)}"
                         aria-label="View details for ${escapeHtml(name)}, ${escapeHtml(occupation)}">
                    <div class="member-avatar" style="background-image: ${avatarStyle}" aria-hidden="true"></div>
                    <div class="member-text">
                        <p class="member-name">${escapeHtml(name)}</p>
                        <p class="member-occupation">${escapeHtml(occupation)}</p>
                    </div>
                </article>
            </li>
        `.trim();
    }

    /**
     * Render the full member list, honouring the visible-by-default limit.
     * @param {Array} members
     */
    function renderMembers(members) {
        const list = document.getElementById('membersList');
        if (!list) return;

        if (!members || !members.length) {
            list.innerHTML = '';
            return;
        }

        list.innerHTML = members
            .map((m, index) => renderMember(m, index >= VISIBLE_BY_DEFAULT))
            .join('');
    }

    /**
     * Wire up member-card clicks/keys to open the provider
     * person-details page, carrying the real worker_id.
     */
    function initMemberNavigation() {
        const list = document.getElementById('membersList');
        if (!list) return;

        function openMember(card) {
            const workerId = card.getAttribute('data-worker-id');
            const name = card.getAttribute('data-name') || '';
            const occupation = card.getAttribute('data-occupation') || '';
            const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

            const member = {
                worker_id: workerId ? Number(workerId) : null,
                name: name,
                occupation: occupation,
                team: TEAM ? TEAM.name : '',
            };

try {
    sessionStorage.setItem(
        'handyhire.selectedMember',
        JSON.stringify(member)
    );

    /*
     * Keep old key temporarily for
     * compatibility with other pages.
     */
    sessionStorage.setItem(
        'handyhire.provider.selectedMember',
        JSON.stringify(member)
    );

    if (workerId) {
        sessionStorage.setItem(
            'handyhire.selectedWorkerId',
            workerId
        );
    }

} catch (e) {}


window.location.href =
    'provider-team-member.html';

            const url = 'provider-job-hire.html?worker=' + encodeURIComponent(slug) + '&source=team';
            if (workerId) url += '&worker_id=' + encodeURIComponent(workerId);

            try {
                sessionStorage.setItem('handyhire.provider.previousPage', 'provider-team-page.html');
            } catch (e) {}
            window.location.href = url;
        }

        list.addEventListener('click', function (event) {
            const card = event.target.closest('.member-card');
            if (!card || !list.contains(card)) return;
            openMember(card);
        });

        list.addEventListener('keydown', function (event) {
            const card = event.target.closest('.member-card');
            if (!card || !list.contains(card)) return;
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openMember(card);
            }
        });
    }

    /**
     * Wire up the BOOK WHOLE TEAM CTA.
     */
    function initBookWholeTeam() {
        const btn = document.getElementById('bookWholeTeamBtn');
        if (!btn) return;

        // Team booking is not implemented in the backend. Never send
        // providers to the demo provider-booking.html page; surface an
        // honest inline message instead using the existing design.
        btn.addEventListener('click', function () {
            let note = document.getElementById('teamBookingNote');
            if (!note) {
                note = document.createElement('p');
                note.id = 'teamBookingNote';
                note.className = 'team-book-note';
                note.setAttribute('role', 'status');
                btn.insertAdjacentElement('afterend', note);
            }
            note.textContent = 'Team booking is not available yet.';
        });
    }

    /**
     * Wire up the expand/collapse arrow.
     */
    function initExpand() {
        const btn = document.getElementById('expandBtn');
        const list = document.getElementById('membersList');
        if (!btn || !list) return;

        const extras = TEAM ? TEAM.members.length - VISIBLE_BY_DEFAULT : 0;
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
     * Fetch the team and its member worker profiles, then render.
     */
    async function loadTeam() {
        const selectedPackage =
    readSelectedPackage();

const params =
    new URLSearchParams(
        window.location.search
    );

const requestedPackageId =
    Number(
        params.get('package_id')
    ) || null;


/*
 * TEAM PACKAGE MODE
 *
 * A Team Package is NOT a Team object.
 * It contains individually selected workers.
 */
if (
    selectedPackage &&
    (
        !requestedPackageId ||
        Number(selectedPackage.id) ===
            requestedPackageId
    )
) {
    showMessage('Loading team...');

    const packageWorkers =
        Array.isArray(
            selectedPackage.workers
        )
            ? selectedPackage.workers
            : (
                Array.isArray(
                    selectedPackage.team_members
                )
                    ? selectedPackage.team_members
                    : []
            );


    const workerProfiles =
        await Promise.all(
            packageWorkers.map(
                function (worker) {

                    const workerId =
                        Number(
                            worker.worker_id ||
                            worker.id
                        );

                    if (!workerId) {
                        return Promise.resolve(null);
                    }

                    return window.HandyHireAPI
                        .apiFetch(
                            '/api/workers/' +
                            encodeURIComponent(
                                String(workerId)
                            )
                        )
                        .then(function (response) {

                            return response.ok
                                ? response.json()
                                : null;
                        })
                        .catch(function () {
                            return null;
                        });
                }
            )
        );


    const members =
        packageWorkers.map(
            function (worker, index) {

                const profile =
                    workerProfiles[index];

                return {
                    worker_id:
                        Number(
                            worker.worker_id ||
                            worker.id
                        ),

                    full_name:
                        (
                            profile &&
                            profile.full_name
                        ) ||
                        worker.full_name ||
                        worker.name ||
                        'Worker',

                    profession:
                        (
                            profile &&
                            profile.profession
                        ) ||
                        worker.profession ||
                        'Team member',

                    profile_image:
                        (
                            profile &&
                            profile.profile_image
                        ) ||
                        worker.profile_image ||
                        null
                };
            }
        );


    TEAM = {
        id: selectedPackage.id,
        name:
            selectedPackage.name ||
            'Team Package',
        members: members,
        is_package: true
    };


    renderTeamHeader(TEAM);
    renderMembers(TEAM.members);
    initMemberNavigation();
    initBookWholeTeam();
    initExpand();

    return;
}
        const teamId = readTeamId();
        if (!teamId) {
            showMessage('Select a team to view its details.');
            return;
        }

        showMessage('Loading team...');

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

            const memberPromises = (team.members || []).map(function (m) {
                return window.HandyHireAPI.apiFetch('/api/workers/' + encodeURIComponent(String(m.worker_id)))
                    .then(function (r) { return r.ok ? r.json() : null; })
                    .catch(function () { return null; });
            });

            const workerProfiles = await Promise.all(memberPromises);

            const enrichedMembers = (team.members || []).map(function (m, i) {
                return {
                    worker_id: m.worker_id,
                    role: m.role,
                    full_name: workerProfiles[i] ? workerProfiles[i].full_name : null,
                    profession: workerProfiles[i] ? workerProfiles[i].profession : null,
                    profile_image: workerProfiles[i] ? workerProfiles[i].profile_image : null,
                };
            });

            TEAM = {
                id: team.id,
                name: team.name,
                description: team.description,
                creator_name: team.creator_name,
                members: enrichedMembers,
            };

            renderTeamHeader(TEAM);
            renderMembers(TEAM.members);
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
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
