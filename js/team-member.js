/* =========================================================
   HandyHire - Team Member JavaScript
   Reads the selected member (and selected team) from
   sessionStorage - written by team-page.js when the user
   taps a member card. Displays the member's details. This
   page is part of the Team Package flow only; there is NO
   booking CTA and NO redirect to job-hire / worker-profile.
   ========================================================= */

(function () {
    'use strict';

    /**
     * Generate a placeholder avatar data URL.
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
     * Read the selected member from sessionStorage.
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
     * Set the textContent of an element when both are
     * present.
     */
    function setText(id, value) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = value;
    }

    /**
     * Populate the page from the stored member record,
     * enriching with real backend data from
     * GET /api/workers/{worker_id} when available.
     */
    async function populatePage() {
        const member = readSelectedMember();
        const name = (member && member.name) || 'Team Member';
        const occupation = (member && member.occupation) || 'Team Member';
        const team = (member && member.team) || 'Selected Team';

        setText('memberNameLarge', name);
        setText('memberInfoOccupation', occupation);
        setText('memberTeamLine', 'Part of: ' + team);

        let worker = null;
        if (member && member.worker_id && window.HandyHireAPI && typeof window.HandyHireAPI.apiFetch === 'function') {
            try {
                const resp = await window.HandyHireAPI.apiFetch('/api/workers/' + encodeURIComponent(String(member.worker_id)));
                if (resp.ok) {
                    worker = await resp.json();
                }
            } catch (e) {
                // fall through to neutral placeholders
            }
        }

        setText('memberInfoAge', '\u2014');
        setText('memberInfoMobile', '\u2014');
        setText('memberInfoEmail', '\u2014');
        setText('memberInfoAddress', worker && worker.location ? worker.location : '\u2014');
        setText('memberInfoQualification', worker && worker.qualification ? worker.qualification : '\u2014');

        const avatar = document.getElementById('memberAvatarLarge');
        if (avatar) {
            if (worker && worker.profile_image) {
                avatar.style.backgroundImage = 'url("' + worker.profile_image + '")';
            } else {
                avatar.style.backgroundImage = buildAvatar(name);
            }
        }
    }

    /**
     * Initialize the Team Member page.
     */
    function init() {
        if (!(window.HandyHireAPI && window.HandyHireAPI.requireRole('customer'))) return;
        populatePage();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
