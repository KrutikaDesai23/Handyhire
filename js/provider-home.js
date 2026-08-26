/* =========================================================
   HandyHire - Provider Home
   Shows all registered worker/provider accounts
   ========================================================= */

(function () {
    'use strict';

    const FILTER_KEY = 'handyhire.provider.homeFilter';

    const VALID_FILTERS = new Set([
        'all',
        'pre-booking',
        'on-spot',
        'near-me',
        'budget'
    ]);


    /* =========================================================
       AUTH CHECK
       ========================================================= */

    function requireAuth() {
        if (
            !window.HandyHireAPI ||
            !window.HandyHireAPI.isLoggedIn()
        ) {
            window.location.href = 'login.html';
            return false;
        }

        return true;
    }


    /* =========================================================
       ESCAPE HTML
       ========================================================= */

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }


    /* =========================================================
       PLACEHOLDER AVATAR
       ========================================================= */

    function buildAvatar(name) {
        const clean = String(name || '?').trim() || '?';

        const initials = clean
            .split(' ')
            .filter(Boolean)
            .map(function (part) {
                return part.charAt(0).toUpperCase();
            })
            .slice(0, 2)
            .join('') || '?';

        const hue = Array.from(clean).reduce(
            function (sum, character) {
                return sum + character.charCodeAt(0);
            },
            0
        ) % 360;

        const svg = `
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 72 72"
            >
                <defs>
                    <linearGradient
                        id="g"
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="1"
                    >
                        <stop
                            offset="0%"
                            stop-color="hsl(${hue}, 35%, 70%)"
                        />

                        <stop
                            offset="100%"
                            stop-color="hsl(${(hue + 40) % 360}, 30%, 55%)"
                        />
                    </linearGradient>
                </defs>

                <rect
                    width="72"
                    height="72"
                    fill="url(#g)"
                />

                <text
                    x="50%"
                    y="54%"
                    text-anchor="middle"
                    font-family="Inter, sans-serif"
                    font-size="28"
                    font-weight="700"
                    fill="#ffffff"
                    dominant-baseline="middle"
                >
                    ${initials}
                </text>
            </svg>
        `.trim();

        return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
    }


    /* =========================================================
       EMPTY / ERROR MESSAGE
       ========================================================= */

    function showMessage(container, message) {
        if (!container) return;

        container.innerHTML = `
            <p
                class="empty-state"
                style="
                    grid-column: 1 / -1;
                    text-align: center;
                    color: var(--color-text-muted);
                    padding: 32px 0;
                "
            >
                ${escapeHtml(message)}
            </p>
        `;
    }


    /* =========================================================
       WORKER AVATAR
       ========================================================= */

    function getWorkerAvatar(worker) {
        if (worker.profile_image) {
            const image = String(worker.profile_image)
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"');

            return `url("${image}")`;
        }

        return buildAvatar(worker.full_name);
    }


    /* =========================================================
       RENDER ALL REGISTERED WORKERS
       ========================================================= */

    function renderWorkers(container, workers) {
        if (!container) return;

        if (!Array.isArray(workers) || workers.length === 0) {
            showMessage(
                container,
                'No registered workers found.'
            );

            return;
        }

        container.innerHTML = workers.map(function (worker) {

            const name =
                worker.full_name || 'Worker';

            const profession =
                worker.profession || 'Professional';

            const location =
                worker.location || 'Location not specified';

            const price =
                Number(worker.price || 0);

            const rating =
                worker.average_rating != null
                    ? Number(worker.average_rating)
                    : null;

            return `
                <article
                    class="worker-card"
                    data-worker-id="${escapeHtml(worker.id)}"
                >

                    <div
                        class="worker-avatar"
                        style="
                            background-image:
                            ${getWorkerAvatar(worker)};
                        "
                        aria-label="${escapeHtml(name)}"
                    ></div>


                    <h3 class="worker-name">
                        ${escapeHtml(name)}
                    </h3>


                    <p class="worker-profession">
                        ${escapeHtml(profession)}
                    </p>


                    <p
                        class="worker-profession"
                        style="margin-top: -4px;"
                    >
                        📍 ${escapeHtml(location)}
                    </p>


                    <div class="worker-meta">

                        <span class="worker-rating">

                            <span class="star">
                                ★
                            </span>

                            ${
                                rating !== null
                                    ? escapeHtml(rating.toFixed(1))
                                    : 'New'
                            }

                        </span>


                        <span class="worker-price">
                            ₹${escapeHtml(price)}
                        </span>

                    </div>

                </article>
            `;
        }).join('');
    }


    /* =========================================================
       LOAD WORKERS FROM BACKEND
       ========================================================= */

    async function loadWorkers() {

        const container =
            document.getElementById('serviceGrid');

        if (!container) return;


        showMessage(
            container,
            'Loading workers...'
        );


        try {

            const response =
                await window.HandyHireAPI.apiFetch(
                    '/api/worker/directory'
                );


            /* ---------- Not logged in ---------- */

            if (response.status === 401) {

                window.HandyHireAPI.clearAuth();

                window.location.href =
                    'login.html';

                return;
            }


            /* ---------- Wrong account role ---------- */

            if (response.status === 403) {

                showMessage(
                    container,
                    'You do not have provider access to this page.'
                );

                return;
            }


            /* ---------- Other backend error ---------- */

            if (!response.ok) {

                let errorMessage =
                    'Unable to load workers. Please try again.';

                try {

                    const errorData =
                        await response.json();

                    if (
                        errorData &&
                        typeof errorData.detail === 'string'
                    ) {
                        errorMessage =
                            errorData.detail;
                    }

                } catch (error) {}


                showMessage(
                    container,
                    errorMessage
                );

                return;
            }


            /* ---------- Success ---------- */

            const workers =
                await response.json();


            renderWorkers(
                container,
                workers
            );


        } catch (error) {

            console.error(
                'Failed to load workers:',
                error
            );


            showMessage(
                container,
                'Network error. Please check your connection and try again.'
            );
        }
    }


    /* =========================================================
       FILTER CHIPS
       ========================================================= */

    function setActiveFilter(filter) {

        const chips =
            document.querySelectorAll(
                '.filter-chips .chip'
            );


        const selected =
            VALID_FILTERS.has(filter)
                ? filter
                : 'all';


        chips.forEach(function (chip) {

            const isActive =
                chip.dataset.filter === selected;


            chip.classList.toggle(
                'is-active',
                isActive
            );


            chip.setAttribute(
                'aria-pressed',
                isActive
                    ? 'true'
                    : 'false'
            );
        });


        try {

            sessionStorage.setItem(
                FILTER_KEY,
                selected
            );

        } catch (error) {}
    }


    function initFilterChips() {

        const chips =
            document.querySelectorAll(
                '.filter-chips .chip'
            );


        if (!chips.length) return;


        /*
         * Always start Home on All.
         *
         * Later we will add actual Pre-booking,
         * On-spot, Near me and Budget filtering.
         */

        setActiveFilter('all');


        chips.forEach(function (chip) {

            chip.addEventListener(
                'click',
                function () {

                    const filter =
                        chip.dataset.filter || 'all';


                    /*
                     * Change green active chip
                     * without reloading the page.
                     */

                    setActiveFilter(filter);


                    /*
                     * IMPORTANT:
                     * Worker filtering will be connected later.
                     *
                     * Right now all registered workers remain
                     * visible while we test the directory.
                     */
                }
            );
        });
    }


    /* =========================================================
       TOP NAVIGATION
       ========================================================= */

    function initTopNav() {

        const activityTab =
            document.getElementById(
                'activityTab'
            );


        if (activityTab) {

            activityTab.addEventListener(
                'click',
                function (event) {

                    event.preventDefault();

                    window.location.href =
                        'provider-activity.html';
                }
            );
        }
    }


    /* =========================================================
       PACKAGE TILES
       ========================================================= */

    function initPackageTiles() {

        const section =
            document.querySelector(
                '.pkg-section'
            );


        if (!section) return;


        section.addEventListener(
            'keydown',
            function (event) {

                if (event.key !== ' ') {
                    return;
                }


                const tile =
                    event.target.closest(
                        '.pkg-tile'
                    );


                if (
                    !tile ||
                    !section.contains(tile)
                ) {
                    return;
                }


                event.preventDefault();


                const href =
                    tile.getAttribute(
                        'href'
                    );


                if (href) {

                    window.location.href =
                        href;
                }
            }
        );
    }


    /* =========================================================
       INITIALIZE HOME PAGE
       ========================================================= */

    function init() {

        if (!requireAuth()) {
            return;
        }


        /*
         * Main change:
         * Load ALL registered workers,
         * not teams.
         */

        loadWorkers();


        initFilterChips();

        initPackageTiles();

        initTopNav();
    }


    /* =========================================================
       START
       ========================================================= */

    if (
        document.readyState === 'loading'
    ) {

        document.addEventListener(
            'DOMContentLoaded',
            init
        );

    } else {

        init();
    }

})();