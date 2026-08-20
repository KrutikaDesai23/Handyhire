/* =========================================================
   HandyHire - Customer Profile JavaScript
   Reads the customer profile stored by customer-register.js
   (localStorage keys: 'customerName', 'customerProfile')
   and writes the values into the profile page.
   Falls back to a safe placeholder when no profile exists.
   ========================================================= */

(function () {
    'use strict';

    /**
     * Storage keys written by js/customer-register.js on
     * successful registration. Keep these in sync if the
     * registration script is renamed.
     */
    const STORAGE_KEYS = {
        NAME:    'customerName',
        PROFILE: 'customerProfile',
    };

    /**
     * Safe fallback values shown when nothing is in storage.
     */
    const FALLBACK = {
        fullName:     'Rushda Sayed',
        occupation:   'Engineer',
        age:          '8 years',
        mobile:       '+91 99876 54321',
        email:        'rushda.sayed@handyhire.test',
        address:      'Sector 12, Noida, Uttar Pradesh',
        qualification: "Bachelor's in Engineering, certified for residential projects",
        description:  'A reliable engineer with a strong record of on-time, high-quality work for residential customers.',
        rating:       4.8,
        reviews:      124,
    };

    /**
     * Read the stored customer profile. Always returns a
     * populated object so callers don't need to null-check.
     * @returns {{
     *   fullName: string, occupation: string, age: string,
     *   mobile: string, email: string, address: string,
     *   qualification: string, description: string,
     *   rating: number, reviews: number
     * }}
     */
    function readStoredProfile() {
        const result = Object.assign({}, FALLBACK);

        try {
            const raw = localStorage.getItem(STORAGE_KEYS.PROFILE);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    if (parsed.fullName) result.fullName = String(parsed.fullName).trim();
                    if (parsed.mobile)   result.mobile   = String(parsed.mobile).trim();
                    if (parsed.email)    result.email    = String(parsed.email).trim();
                    if (parsed.address)  result.address  = String(parsed.address).trim();
                }
            }
        } catch (e) {
            // Fall through to legacy key handling.
        }

        // Legacy / simple fallback: read the standalone
        // 'customerName' key written by the registration form.
        try {
            const legacyName = localStorage.getItem(STORAGE_KEYS.NAME);
            if (legacyName && legacyName.trim()) {
                result.fullName = legacyName.trim();
            }
        } catch (e) {
            // Ignore.
        }

        return result;
    }

    /**
     * Set the text content of an element only when both
     * the element and the new value are present.
     */
    function setText(id, value) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = value;
    }

    /**
     * Generate a placeholder avatar data URL so the
     * profile renders meaningfully without external
     * image dependencies.
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
     * Populate the profile hero and personal information
     * sections with the stored customer data.
     */
    function populateProfile() {
        const profile = readStoredProfile();

        setText('profileHeroName', profile.fullName);
        setText('infoFullName',    profile.fullName);
        setText('infoMobile',      profile.mobile);
        setText('infoEmail',       profile.email);
        setText('infoAddress',     profile.address);

        const avatar = document.getElementById('profileHeroAvatar');
        if (avatar) {
            avatar.style.backgroundImage = buildAvatar(profile.fullName);
        }
    }

    /**
     * Hydrate profile from the backend if a token exists.
     */
    async function hydrateFromBackend() {
        if (!window.HandyHireAPI || !window.HandyHireAPI.isLoggedIn()) {
            return;
        }
        try {
            const user = await window.HandyHireAPI.fetchCurrentUser();
            if (!user) return;

            setText('profileHeroName', user.full_name || '');
            setText('infoFullName',    user.full_name || '');
            setText('infoMobile',      user.mobile_number || '');
            setText('infoEmail',       user.email || '');
            setText('infoAddress',     user.address || '');

            const avatar = document.getElementById('profileHeroAvatar');
            if (avatar && user.full_name) {
                avatar.style.backgroundImage = buildAvatar(user.full_name);
            }
        } catch (e) {
            // Ignore backend errors - fall back to stored profile.
        }
    }

    /**
     * Populate the quick stats section using the profile
     * data already available in localStorage.
     */
    function renderStats() {
        const profile = readStoredProfile();

        const ratingVal = Number(profile.rating);
        setText('statRating',  Number.isFinite(ratingVal) ? ratingVal.toFixed(1) : '--');
        setText('statReviews', profile.reviews != null ? String(profile.reviews) : '--');
    }

    /**
     * Wire up the Signout button. Routes to the welcome
     * page (index.html).
     */
    function initSignOut() {
        const btn = document.getElementById('signOutBtn');
        if (!btn) return;

        btn.addEventListener('click', function () {
            if (window.HandyHireAPI) {
                window.HandyHireAPI.clearAuth();
            }
            window.location.href = '../index.html';
        });
    }

    /**
     * Initialize the Customer Profile page.
     */
    function init() {
        populateProfile();
        renderStats();
        initSignOut();
        hydrateFromBackend();
    }

    // Run after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
