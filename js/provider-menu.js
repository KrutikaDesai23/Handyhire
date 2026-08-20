/* =========================================================
   HandyHire - Side Navigation Menu JavaScript
   Controls the slide-in drawer, backdrop, and
   keyboard / focus handling.
   ========================================================= */

(function () {
    'use strict';

    /**
     * Per-item navigation targets. The matching destination
     * pages are listed for reference; if a page does not
     * exist yet the link still navigates - the browser will
     * just show its own 404 until the page is created.
     *   profile.html       - exists
     *   activity.html      - exists
     *   notifications.html - TODO: create pages/notifications.html
     *   settings.html      - TODO: create pages/settings.html
     *   about.html         - TODO: create pages/about.html
     *   contact.html       - TODO: create pages/contact.html
     *   index.html         - exists (Logout -> Welcome)
     */

    /**
     * Open the side drawer.
     * @param {HTMLElement} drawer
     * @param {HTMLElement} backdrop
     */
    function openDrawer(drawer, backdrop) {
        drawer.classList.add('is-open');
        drawer.setAttribute('aria-hidden', 'false');
        backdrop.classList.add('is-visible');
        backdrop.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    /**
     * Close the side drawer.
     * @param {HTMLElement} drawer
     * @param {HTMLElement} backdrop
     */
    function closeDrawer(drawer, backdrop) {
        drawer.classList.remove('is-open');
        drawer.setAttribute('aria-hidden', 'true');
        backdrop.classList.remove('is-visible');
        backdrop.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    /**
     * Generate a placeholder avatar data URL so the drawer
     * renders meaningfully without an external image dependency.
     * @param {string} name
     * @returns {string} CSS background value
     */
    function buildAvatar(name) {
        const initials = name
            .split(' ')
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase())
            .slice(0, 2)
            .join('') || 'C';

        const svg = `
            <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'>
                <circle cx='40' cy='40' r='40' fill='rgba(255,255,255,0.25)'/>
                <text x='50%' y='54%' text-anchor='middle'
                      font-family='Inter, sans-serif' font-size='30'
                      font-weight='700' fill='#ffffff' dominant-baseline='middle'>
                    ${initials}
                </text>
            </svg>
        `.trim();

        return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
    }

    /**
     * Populate the profile section of the drawer with the
     * supplied user info. Falls back to a generic placeholder.
     * @param {{ name?: string, avatar?: string }} user
     */
    function populateProfile(user) {
        const nameEl = document.getElementById('drawerName');
        const avatarEl = document.getElementById('drawerAvatar');

        const name = (user && user.name) ? user.name : 'Customer';
        if (nameEl) nameEl.textContent = name;
        if (avatarEl) {
            avatarEl.style.backgroundImage = (user && user.avatar)
                ? `url("${user.avatar}")`
                : buildAvatar(name);
        }
    }

    /**
     * Wire up the hamburger button, backdrop click, and Escape
     * key to open and close the drawer.
     */
    function initDrawerToggle() {
        const drawer = document.getElementById('menuDrawer');
        const backdrop = document.getElementById('menuBackdrop');
        const openBtn = document.getElementById('menuCloseBtn');
        if (!drawer || !backdrop || !openBtn) return;

        // The header button toggles: opens when closed, closes when open.
        openBtn.addEventListener('click', function () {
            if (drawer.classList.contains('is-open')) {
                closeDrawer(drawer, backdrop);
            } else {
                openDrawer(drawer, backdrop);
            }
        });

        // Click on the dimmed backdrop closes the drawer.
        backdrop.addEventListener('click', function () {
            closeDrawer(drawer, backdrop);
        });

        // Escape key closes the drawer for keyboard users.
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && drawer.classList.contains('is-open')) {
                closeDrawer(drawer, backdrop);
                openBtn.focus();
            }
        });
    }

    /**
     * Each menu item is a real <a href> anchor; we let the
     * browser handle navigation so middle-click / cmd-click
     * continue to work as expected. The handler is kept so
     * the active state can be tracked in the future without
     * having to rewire navigation.
     */
    function initMenuItems() {
        // intentionally empty - <a href> covers navigation
    }

    /**
     * Initialize the menu page.
     */
    function init() {
        populateProfile();
        initDrawerToggle();
        initMenuItems();
    }

    // Run after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
