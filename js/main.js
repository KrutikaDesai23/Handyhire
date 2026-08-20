/* =========================================================
   HandyHire - Main JavaScript
   Handles Welcome screen button navigation
   ========================================================= */

(function () {
    'use strict';

    /**
     * Page routes for the HandyHire application.
     * Centralized so future pages can be added easily.
     */
    const ROUTES = {
        PROVIDE_SERVICE: 'pages/provider-animation.html',
        ACQUIRE_SERVICE: 'pages/handyhire-animation.html',
    };

    /**
     * Navigate the user to the given path while
     * honoring modifier keys (open in new tab when requested).
     *
     * @param {string} path - Destination URL.
     * @param {MouseEvent} event - The originating click event.
     */
    function navigateTo(path, event) {
        // Allow Ctrl / Cmd / Shift clicks to open in a new tab.
        if (event && (event.ctrlKey || event.metaKey || event.shiftKey)) {
            window.open(path, '_blank', 'noopener,noreferrer');
            return;
        }
        window.location.href = path;
    }

    /**
     * Attach click listeners to the welcome screen buttons.
     * Runs after the DOM is ready.
     */
    function initWelcomeScreen() {
        const provideBtn = document.getElementById('provideServiceBtn');
        const acquireBtn = document.getElementById('acquireServiceBtn');

        if (provideBtn) {
            provideBtn.addEventListener('click', function (event) {
                navigateTo(ROUTES.PROVIDE_SERVICE, event);
            });
        }

        if (acquireBtn) {
            acquireBtn.addEventListener('click', function (event) {
                navigateTo(ROUTES.ACQUIRE_SERVICE, event);
            });
        }
    }

    // Initialize when DOM is ready.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWelcomeScreen);
    } else {
        initWelcomeScreen();
    }
})();
