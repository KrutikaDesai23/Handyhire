/* =========================================================
   HandyHire - Team Member JavaScript
   Reads the selected member from sessionStorage and,
   when a real worker_id is present, fetches the worker's
   profile from GET /api/workers/{worker_id}. The old
   MEMBER_DETAILS mock catalog is no longer used as the
   normal data source.
   ========================================================= */

(function () {
    'use strict';

    /**
     * Generate a placeholder avatar data URL.
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
     * Set textContent when both element and value are present.
     * @param {string} id
     * @param {string} value
     */
    function setText(id, value) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = value == null || value === '' ? '\u2014' : value;
    }

    /**
     * Populate the page using real backend data when a
     * worker_id is available; otherwise fall back to the
     * stored member fields and neutral placeholders.
     */
    async function populatePage() {
        const member = readSelectedMember();
        const name = (member && member.name) || 'Team Member';
        const occupation = (member && member.occupation) || 'Team Member';
        const team = (member && member.team) || 'Selected Team';

        setText('memberNameLarge', name);
        setText('memberInfoOccupation', occupation);
        setText('memberTeamLine', 'Part of: ' + team);

        const avatar = document.getElementById('memberAvatarLarge');
        if (avatar) avatar.style.backgroundImage = buildAvatar(name);

        if (member && member.worker_id && window.HandyHireAPI) {
            try {
                const resp = await window.HandyHireAPI.apiFetch('/api/workers/' + encodeURIComponent(String(member.worker_id)));
                if (resp.ok) {
                    const data = await resp.json();
                    setText('memberNameLarge', data.full_name || name);
                    setText('memberInfoOccupation', data.profession || occupation);
                    setText('memberInfoQualification', data.qualification || '\u2014');
                    setText('memberInfoAge', '\u2014');
                    setText('memberInfoMobile', '\u2014');
                    setText('memberInfoEmail', '\u2014');
                    setText('memberInfoAddress', '\u2014');
                    if (avatar && data.profile_image) {
                        avatar.style.backgroundImage = 'url("' + data.profile_image + '")';
                    }
                    return;
                }
            } catch (e) {
                // fall through to fallback below
            }
        }

        setText('memberInfoAge', '\u2014');
        setText('memberInfoMobile', '\u2014');
        setText('memberInfoEmail', '\u2014');
        setText('memberInfoAddress', '\u2014');
        setText('memberInfoQualification', '\u2014');
    }

    /**
     * Initialize the Team Member page.
     */
    async function init() {
        await populatePage();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
