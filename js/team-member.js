/* =========================================================
   HandyHire - Customer Team Member Details
   Mirrors provider-job-hire visual structure while keeping
   this page view-only inside the Team Package flow.
   ========================================================= */

(function () {
    'use strict';

    function buildAvatar(name) {
        const clean = String(name || 'Worker');
        const initials = clean.split(' ').filter(Boolean)
            .map(function (part) { return part.charAt(0).toUpperCase(); })
            .slice(0, 2).join('') || '?';
        const hue = Array.from(clean).reduce(function (sum, ch) {
            return sum + ch.charCodeAt(0);
        }, 0) % 360;
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'>
            <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
                <stop offset='0%' stop-color='hsl(${hue},35%,70%)'/>
                <stop offset='100%' stop-color='hsl(${(hue + 40) % 360},30%,55%)'/>
            </linearGradient></defs>
            <circle cx='60' cy='60' r='60' fill='url(#g)'/>
            <text x='50%' y='54%' text-anchor='middle' font-family='Inter,sans-serif' font-size='44' font-weight='700' fill='#fff' dominant-baseline='middle'>${initials}</text>
        </svg>`;
        return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

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

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value == null || value === '' ? '--' : value;
    }

    function renderInfoGrid(data) {
        const grid = document.getElementById('infoGrid');
        if (!grid) return;
        const items = [
            { label: 'Occupation', value: data.profession || '--', icon: '&#128188;' },
            { label: 'Experience', value: data.experience || '--', icon: '&#9201;' },
            { label: 'Mobile No.', value: data.mobile || '--', icon: '&#128241;' },
            { label: 'Email ID', value: data.email || '--', icon: '&#9993;' },
            { label: 'Location', value: data.location || '--', icon: '&#127968;' },
            { label: 'Qualification', value: data.qualification || '--', icon: '&#127891;' },
        ];
        grid.innerHTML = items.map(function (item) {
            return '<li class="info-card">' +
                '<span class="info-card-icon" aria-hidden="true">' + item.icon + '</span>' +
                '<div class="info-card-text">' +
                    '<p class="info-card-label">' + escapeHtml(item.label) + '</p>' +
                    '<p class="info-card-value">' + escapeHtml(item.value) + '</p>' +
                '</div>' +
            '</li>';
        }).join('');
    }

    function renderServices(profession) {
        const list = document.getElementById('servicesPills');
        if (!list) return;
        const label = profession || 'Team member';
        list.innerHTML = '<li class="service-pill">' + escapeHtml(label) + '</li>' +
            '<li class="service-pill">Included in team package</li>';
    }

    async function populatePage() {
        const member = readSelectedMember();
        const name = (member && member.name) || 'Team Member';
        const profession = (member && member.occupation) || 'Team Member';
        const team = (member && member.team) || 'Selected Team';

        setText('profileName', name);
        setText('profileOccupation', profession);
        setText('profileBio', name + ' is included in the selected HandyHire team package as a ' + profession + '.');
        setText('teamNameText', team);
        setText('teamSummaryText', 'Part of ' + team + '. Return to the team page to continue the booking.');
        setText('availabilityText', 'Included in ' + team);

        let worker = null;
        if (member && member.worker_id && window.HandyHireAPI && typeof window.HandyHireAPI.apiFetch === 'function') {
            try {
                const response = await window.HandyHireAPI.apiFetch('/api/workers/' + encodeURIComponent(String(member.worker_id)));
                if (response.ok) worker = await response.json();
            } catch (e) {}
        }

        const data = {
            profession: profession,
            experience: worker && worker.experience ? worker.experience : '--',
            mobile: worker && worker.mobile_number ? worker.mobile_number : '--',
            email: worker && worker.email ? worker.email : '--',
            location: worker && (worker.location || worker.city) ? (worker.location || worker.city) : '--',
            qualification: worker && worker.qualification ? worker.qualification : '--',
        };

        renderInfoGrid(data);
        renderServices(profession);
        setText('aboutText', (worker && worker.bio) ? worker.bio : (name + ' is part of ' + team + ' and will be booked together with the complete crew.'));

        const avatar = document.getElementById('profileAvatar');
        if (avatar) {
            avatar.style.backgroundImage = worker && worker.profile_image
                ? 'url("' + String(worker.profile_image).replace(/"/g, '&quot;') + '")'
                : buildAvatar(name);
        }

        document.title = name + ' | HandyHire';
    }

    function initBackLinks() {
        ['backLink', 'backToTeamBtn'].forEach(function (id) {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('click', function (event) {
                event.preventDefault();
                window.location.href = 'team-page.html';
            });
        });
    }

    function init() {
        if (!(window.HandyHireAPI && window.HandyHireAPI.requireRole('customer'))) return;
        initBackLinks();
        populatePage();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
