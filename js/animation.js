/* =========================================================
   HandyHire - Customer Launch Sequence
   Plays the branded intro, starts the exit wipe, then routes
   to customer registration. Tap anywhere to skip immediately.
   ========================================================= */
(function () {
    'use strict';

    const NEXT_PAGE = 'customer-register.html';
    const EXIT_START_MS = 1500;
    const REDIRECT_DELAY_MS = 1950;

    function initAutoRedirect() {
        const reduced = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const page = document.querySelector('.anim-page');
        const exitDelay = reduced ? 350 : EXIT_START_MS;
        const redirectDelay = reduced ? 650 : REDIRECT_DELAY_MS;

        const exitTimer = setTimeout(function () {
            if (page) page.classList.add('is-exiting');
        }, exitDelay);

        const redirectTimer = setTimeout(function () {
            window.location.href = NEXT_PAGE;
        }, redirectDelay);

        window.__handyhireCancelRedirect = function () {
            clearTimeout(exitTimer);
            clearTimeout(redirectTimer);
        };
    }

    function goNow() {
        if (typeof window.__handyhireCancelRedirect === 'function') {
            window.__handyhireCancelRedirect();
        }
        window.location.href = NEXT_PAGE;
    }

    function initSkipLink() {
        const skip = document.querySelector('.anim-skip');
        if (!skip) return;
        skip.addEventListener('click', function (event) {
            event.preventDefault();
            goNow();
        });
    }

    function initStageSkip() {
        const stage = document.querySelector('.anim-stage');
        if (!stage) return;
        stage.addEventListener('click', function (event) {
            if (event.target.closest('.anim-skip')) return;
            goNow();
        });
    }

    function init() {
        initAutoRedirect();
        initSkipLink();
        initStageSkip();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
