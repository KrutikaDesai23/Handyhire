/* =========================================================
   HandyHire - Customer Team Package Details
   Mirrors the provider Team Package detail structure while
   preserving customer member-view and whole-team booking.
   ========================================================= */

(function () {
    'use strict';

    const api = window.HandyHireAPI;
    const VISIBLE_BY_DEFAULT = 4;
    let TEAM = null;
    let currentMembers = [];

    function requireAuth() {
        if (!api || typeof api.requireRole !== 'function') {
            window.location.href = 'login.html';
            return false;
        }
        return api.requireRole('customer') !== false;
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function buildAvatar(name) {
        const clean = String(name || 'Team').trim() || 'Team';
        const initials = clean.split(' ').filter(Boolean)
            .map(function (part) { return part.charAt(0).toUpperCase(); })
            .slice(0, 2).join('') || 'T';
        const hue = Array.from(clean).reduce(function (sum, ch) {
            return sum + ch.charCodeAt(0);
        }, 0) % 360;

        const svg =
            "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'>" +
                "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>" +
                    "<stop offset='0%' stop-color='hsl(" + hue + ",35%,72%)'/>" +
                    "<stop offset='100%' stop-color='hsl(" + ((hue + 35) % 360) + ",35%,55%)'/>" +
                "</linearGradient></defs>" +
                "<rect width='120' height='120' rx='30' fill='url(#g)'/>" +
                "<text x='50%' y='54%' text-anchor='middle' font-family='Inter,sans-serif' font-size='42' font-weight='800' fill='#fff' dominant-baseline='middle'>" + initials + "</text>" +
            "</svg>";

        return 'url("data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '")';
    }

    function formatPrice(amount) {
        return '\u20B9' + Number(amount || 0).toLocaleString('en-IN');
    }

    function getPackageId() {
        try {
            return Number(new URLSearchParams(window.location.search).get('package_id')) || null;
        } catch (e) {
            return null;
        }
    }

    function readStoredPackage() {
        try {
            const raw = sessionStorage.getItem('handyhire.selectedTeamPackage');
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (e) {
            return null;
        }
    }

    function saveStoredPackage(pkg) {
        try {
            sessionStorage.setItem('handyhire.selectedTeamPackage', JSON.stringify(pkg));
        } catch (e) {}
    }

    function getPackageWorkers(pkg) {
        const source = Array.isArray(pkg && pkg.workers)
            ? pkg.workers
            : (Array.isArray(pkg && pkg.team_members) ? pkg.team_members : []);

        return source.map(function (worker) {
            return {
                worker_id: Number(worker.worker_id || worker.id) || null,
                full_name: worker.full_name || worker.name || 'Worker',
                profession: worker.profession || worker.role || 'Team member',
                profile_image: worker.profile_image || null,
                is_leader: worker.is_leader === true,
            };
        }).filter(function (worker) { return worker.worker_id; });
    }

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function renderPackageSummary(pkg, members) {
        const name = pkg.name || 'Team Package';
        const description = pkg.description || 'A coordinated HandyHire crew ready to take on the job together.';

        setText('teamName', name);
        setText('teamDescription', description);
        setText('teamRating', members.length + ' member' + (members.length === 1 ? '' : 's'));
        setText('teamPrice', formatPrice(pkg.price) + ' / hour');
        setText('teamDuration', pkg.duration || 'Flexible');
        setText('teamLocation', pkg.location || 'Flexible');
        setText('teamAvailability', pkg.availability || 'Check schedule');

        const avatar = document.getElementById('teamAvatar');
        if (avatar) avatar.style.backgroundImage = buildAvatar(name);

        const services = Array.isArray(pkg.services)
            ? pkg.services.map(function (service) { return service && service.name; }).filter(Boolean)
            : [];
        const servicesPanel = document.getElementById('servicesPanel');
        if (servicesPanel) {
            if (services.length) {
                setText('teamServices', services.join(' • '));
                servicesPanel.hidden = false;
            } else {
                servicesPanel.hidden = true;
            }
        }
    }

    function updateExpandButton(memberCount) {
        const button = document.getElementById('expandBtn');
        if (!button) return;
        const extraCount = Math.max(0, Number(memberCount || 0) - VISIBLE_BY_DEFAULT);
        button.hidden = extraCount <= 0;
        button.setAttribute('aria-expanded', 'false');
        const label = button.querySelector('span');
        if (label) label.textContent = extraCount > 0 ? 'Show ' + extraCount + ' more' : 'Show more';
    }

    function renderState(message, isError) {
        const list = document.getElementById('membersList');
        if (!list) return;
        list.classList.remove('is-expanded');
        list.innerHTML = '<li class="team-state' + (isError ? ' team-state--error' : '') + '">' + escapeHtml(message) + '</li>';
        updateExpandButton(0);
    }

    function renderMember(member, isExtra) {
        const avatarStyle = member.profile_image
            ? 'url("' + String(member.profile_image).replace(/"/g, '&quot;') + '")'
            : buildAvatar(member.full_name);

        return (
            '<li>' +
                '<article class="member-card' + (isExtra ? ' is-extra' : '') + '" tabindex="0" ' +
                    'data-worker-id="' + escapeHtml(String(member.worker_id)) + '" ' +
                    'data-name="' + escapeHtml(member.full_name) + '" ' +
                    'data-occupation="' + escapeHtml(member.profession) + '" ' +
                    'aria-label="View ' + escapeHtml(member.full_name) + '">' +
                    '<div class="member-avatar" style="background-image:' + avatarStyle + '" aria-hidden="true"></div>' +
                    '<div class="member-text">' +
                        '<p class="member-name">' + escapeHtml(member.full_name) + '</p>' +
                        '<p class="member-occupation">' + escapeHtml(member.profession) + '</p>' +
                    '</div>' +
                '</article>' +
            '</li>'
        );
    }

    function renderMembers(members) {
        const list = document.getElementById('membersList');
        if (!list) return;
        currentMembers = members || [];
        list.classList.remove('is-expanded');
        if (!currentMembers.length) {
            renderState('No team members were found for this package.', false);
            return;
        }
        list.innerHTML = currentMembers.map(function (member, index) {
            return renderMember(member, index >= VISIBLE_BY_DEFAULT);
        }).join('');
        updateExpandButton(currentMembers.length);
    }

    function hydratePackage(pkg) {
        const members = getPackageWorkers(pkg);
        TEAM = {
            id: Number(pkg.id),
            name: pkg.name || 'Team Package',
            description: pkg.description || null,
            price: Number(pkg.price) || 0,
            duration: pkg.duration || null,
            location: pkg.location || null,
            availability: pkg.availability || null,
            services: Array.isArray(pkg.services) ? pkg.services : [],
            members: members,
            package_type: pkg.package_type || 'team',
        };

        try {
            sessionStorage.setItem('handyhire.selectedTeam', TEAM.name);
            sessionStorage.setItem('handyhire.selectedPackageId', String(TEAM.id));
        } catch (e) {}

        renderPackageSummary(TEAM, members);
        renderMembers(members);
    }

    function initMemberNavigation() {
        const list = document.getElementById('membersList');
        if (!list) return;

        function openMember(card) {
            const workerId = card.getAttribute('data-worker-id') || '';
            const name = card.getAttribute('data-name') || '';
            const occupation = card.getAttribute('data-occupation') || '';
            const member = {
                worker_id: workerId ? Number(workerId) : null,
                name: name,
                occupation: occupation,
                team: TEAM ? TEAM.name : '',
            };
            try {
                sessionStorage.setItem('handyhire.selectedMember', JSON.stringify(member));
                sessionStorage.setItem('handyhire.customer.previousPage', window.location.href);
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

    function initExpand() {
        const button = document.getElementById('expandBtn');
        const list = document.getElementById('membersList');
        if (!button || !list) return;
        button.addEventListener('click', function () {
            const expanded = list.classList.toggle('is-expanded');
            button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            const label = button.querySelector('span');
            const extraCount = Math.max(0, currentMembers.length - VISIBLE_BY_DEFAULT);
            if (label) label.textContent = expanded ? 'Show fewer' : 'Show ' + extraCount + ' more';
        });
    }

    function initBookWholeTeam() {
        const button = document.getElementById('bookWholeTeamBtn');
        if (!button) return;
        button.addEventListener('click', function () {
            if (!TEAM || !TEAM.id) return;
            try {
                sessionStorage.setItem('handyhire.selectedTeam', TEAM.name);
                sessionStorage.setItem('handyhire.selectedPackageId', String(TEAM.id));
                sessionStorage.setItem('handyhire.bookingMode', 'team');
                sessionStorage.setItem('handyhire.customer.previousPage', window.location.href);
            } catch (e) {}
            window.location.href = 'booking.html?package_id=' + encodeURIComponent(String(TEAM.id));
        });
    }

    function initBackButton() {
        const back = document.getElementById('backLink');
        if (!back) return;
        back.addEventListener('click', function (event) {
            event.preventDefault();
            window.location.href = 'team-package.html';
        });
    }

    async function loadPackage() {
        const packageId = getPackageId();
        const stored = readStoredPackage();

        if (stored && stored.id && (!packageId || Number(stored.id) === Number(packageId))) {
            hydratePackage(stored);
        } else {
            renderState('Loading team members...', false);
        }

        const requestedId = packageId || (stored && Number(stored.id));
        if (!requestedId) {
            renderState('No team package selected. Please choose a team first.', true);
            return;
        }

        try {
            const response = await api.apiFetch('/api/packages/' + encodeURIComponent(String(requestedId)));
            if (response.status === 401) {
                api.clearAuth();
                window.location.href = 'login.html';
                return;
            }
            if (response.status === 404) {
                renderState('Team package not found.', true);
                return;
            }
            if (!response.ok) {
                renderState('Unable to load team package. Please try again.', true);
                return;
            }

            const pkg = await response.json();
            saveStoredPackage(pkg);
            hydratePackage(pkg);
        } catch (e) {
            if (!TEAM) renderState('Network error. Please check your connection and try again.', true);
        }
    }

    function init() {
        if (!requireAuth()) return;
        initBackButton();
        initMemberNavigation();
        initExpand();
        initBookWholeTeam();
        loadPackage();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
