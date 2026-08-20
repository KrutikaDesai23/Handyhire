/* =========================================================
   HandyHire - Welcome Animation JavaScript
   Auto-redirects to the Customer Registration page after
   a short delay so the brand animation has time to play.
   Honors reduced motion by shortening the delay.
   ========================================================= */

(function () {
    'use strict';

    /**
     * Destination of the auto-redirect. Kept inside the
     * customer flow only - the Service Provider flow is
     * untouched.
     */
    const NEXT_PAGE = 'customer-register.html';

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

        // Allow the user to cancel the redirect by interacting
        // with the page (e.g. clicking the Skip link).
        window.__handyhireCancelRedirect = function () {
            clearTimeout(timer);
            window.removeEventListener('beforeunload', noop);
        };

        const timer = setTimeout(function () {
            window.location.href = NEXT_PAGE;
        }, delay);

        // No-op listener kept to make the cancel helper safe
        // to call repeatedly without throwing.
        function noop() {}
        window.addEventListener('beforeunload', noop);
    }

    function initSkipLink() {
        const skip = document.querySelector('.anim-skip');
        if (!skip) return;
        skip.addEventListener('click', function (event) {
            // The <a href> already handles navigation; we just
            // make sure any pending auto-redirect timer is
            // cleared so it doesn't fire after the navigation.
            if (typeof window.__handyhireCancelRedirect === 'function') {
                window.__handyhireCancelRedirect();
            }
            // Let the browser follow the link normally.
            void event;
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
