/* =========================================================
   HandyHire - Provider Welcome Animation JavaScript
   Auto-redirects to the Service Provider Registration Step 1
   after a short delay. Kept fully separate from the
   customer animation so neither flow can accidentally
   fall into the other.
   ========================================================= */

(function () {
    'use strict';

    /**
     * Destination of the auto-redirect - the first screen
     * of the Service Provider flow.
     */
    const NEXT_PAGE = 'provider-register-step1.html';

    /**
     * How long the animation plays before the redirect.
     * Short enough to feel snappy, long enough for the
     * CSS keyframes to finish their sequence.
     */
    const REDIRECT_DELAY_MS = 2800;

    function initAutoRedirect() {
        const reduced = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const delay = reduced ? 600 : REDIRECT_DELAY_MS;

        const timer = setTimeout(function () {
            window.location.href = NEXT_PAGE;
        }, delay);

        // Allow the user to cancel the redirect by interacting
        // with the page (e.g. clicking the Skip link).
        window.__handyhireProviderCancelRedirect = function () {
            clearTimeout(timer);
        };
    }

    function initSkipLink() {
        const skip = document.querySelector('.anim-skip');
        if (!skip) return;
        skip.addEventListener('click', function () {
            // Cancel the pending redirect so it doesn't fire
            // after the browser has already started navigating.
            if (typeof window.__handyhireProviderCancelRedirect === 'function') {
                window.__handyhireProviderCancelRedirect();
            }
            // Let the <a href> handle the actual navigation.
        });
    }

    function init() {
        initAutoRedirect();
        initSkipLink();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
