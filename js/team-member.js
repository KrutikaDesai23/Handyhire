/* =========================================================
   HandyHire - Team Member JavaScript
   Reads the selected worker ID from URL query params
   and fetches real data from GET /api/workers/{worker_id}.
   Displays the member's details. This page is part of the
   Team Package flow only; there is NO booking CTA and
   NO redirect to job-hire / worker-profile.
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

        return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)})`;
    }

    /**
     * Read worker_id from URL query params.
     * @returns {string|null}
     */
    function readWorkerId() {
        try {
            const params = new URLSearchParams(window.location.search);
            const fromUrl = params.get('worker_id');
            if (fromUrl) return String(fromUrl).trim();
        } catch (e) {
            // Ignore URL errors.
        }
        return null;
    }

    /**
     * Read package_id from URL query params for Back navigation.
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
        return null;
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
     * Set the textContent of an element when both are
     * present.
     */
    function setText(id, value) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = value;
    }

    /**
     * Show an error state on the page.
     */
    function showError(message) {
        setText('memberNameLarge', 'Error');
        setText('memberInfoOccupation', message);
    }

    /**
     * Populate the page from the real API worker response.
     * @param {Object} worker
     */
    function populatePage(worker) {
        const name = worker.full_name || 'Team Member';
        const profession = worker.profession || 'Team Member';

        setText('memberNameLarge', name);
        setText('memberInfoOccupation', profession);

        const teamEl = document.getElementById('memberTeamLine');
        if (teamEl) teamEl.textContent = 'Team Member';

        setText('memberInfoAge', '--');
        setText('memberInfoMobile', '--');
        setText('memberInfoEmail', '--');
        setText('memberInfoAddress', '--');
        setText('memberInfoQualification', '--');

        const avatar = document.getElementById('memberAvatarLarge');
        if (avatar) avatar.style.backgroundImage = buildAvatar(name);
    }

    /**
     * Initialize the Team Member page.
     */
    function init() {
        if (!(window.HandyHireAPI && window.HandyHireAPI.requireRole('customer'))) return;

        const workerId = readWorkerId();
        if (!workerId) {
            showError('No worker selected. Please go back and choose a team member.');
            return;
        }

        const api = getApi();
        if (!api) {
            showError('Unable to load member details. Please try again later.');
            return;
        }

        api.apiFetch('/api/workers/' + encodeURIComponent(workerId))
            .then(function (response) {
                if (response.status === 401) {
                    api.clearAuth();
                    window.location.href = 'login.html';
                    return null;
                }
                if (!response.ok) throw new Error('Worker not found');
                return response.json();
            })
            .then(function (worker) {
                if (!worker) return;
                populatePage(worker);
            })
            .catch(function () {
                showError('Unable to load member details. Please go back and try again.');
            });

        const backBtn = document.getElementById('backLink');
        if (backBtn) {
            backBtn.addEventListener('click', function (event) {
                event.preventDefault();
                const packageId = readPackageId();
                const fallback = packageId
                    ? 'team-page.html?package_id=' + encodeURIComponent(packageId)
                    : 'team-package.html';
                window.location.href = fallback;
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
