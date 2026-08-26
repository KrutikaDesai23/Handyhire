/* =========================================================
   HandyHire - Provider Home
   Registered workers + working filters
   ========================================================= */

(function () {
    'use strict';

    let allWorkers = [];
    let currentFilter = 'all';

    const FILTER_KEY = 'handyhire.provider.homeFilter';


    /* =========================================================
       AUTH
       ========================================================= */

    function requireAuth() {
<<<<<<< Updated upstream
        if (
            !window.HandyHireAPI ||
            !window.HandyHireAPI.isLoggedIn()
        ) {
            window.location.href = 'login.html';
            return false;
        }

        return true;
=======
        if (!(window.HandyHireAPI && typeof window.HandyHireAPI.requireRole === 'function')) {
            window.location.href = 'login.html';
            return false;
        }
        return window.HandyHireAPI.requireRole('worker');
>>>>>>> Stashed changes
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
                <rect
                    width="72"
                    height="72"
                    fill="hsl(${hue}, 30%, 65%)"
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
       MESSAGE
       ========================================================= */

    function showMessage(container, message) {
        if (!container) return;

        container.innerHTML = `
            <p
                class="empty-state"
                style="
                    grid-column: 1 / -1;
                    text-align: center;
                    padding: 32px 0;
                    color: var(--color-text-muted);
                "
            >
                ${escapeHtml(message)}
            </p>
        `;
    }


    /* =========================================================
       WORKER IMAGE
       ========================================================= */

    function getWorkerAvatar(worker) {
        if (worker.profile_image) {
            return `url("${worker.profile_image}")`;
        }

        return buildAvatar(worker.full_name);
    }


    /* =========================================================
       RENDER WORKERS
       ========================================================= */

    function renderWorkers(workers) {
        const container =
            document.getElementById('serviceGrid');

        if (!container) return;


        if (!Array.isArray(workers) || workers.length === 0) {

            let message = 'No workers found.';

            if (currentFilter === 'pre-booking') {
                message = 'No pre-booking workers available.';
            }

            if (currentFilter === 'on-spot') {
                message = 'No on-spot workers available.';
            }

            if (currentFilter === 'near-me') {
                message = 'No workers found near your location.';
            }

            if (currentFilter === 'budget') {
                message = 'No workers available.';
            }

            showMessage(container, message);

            return;
        }


        container.innerHTML =
            workers.map(function (worker) {

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

                let availabilityText = '';

                const availability =
                    String(worker.availability || '')
                        .toLowerCase()
                        .trim();

                if (availability === 'pre-booking') {
                    availabilityText = 'Pre-booking';
                }

                if (availability === 'on-spot') {
                    availabilityText = 'On-spot';
                }

                if (availability === 'both') {
                    availabilityText = 'Pre-booking + On-spot';
                }


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
                        ></div>


                        <h3 class="worker-name">
                            ${escapeHtml(name)}
                        </h3>


                        <p class="worker-profession">
                            ${escapeHtml(profession)}
                        </p>


                        <p
                            class="worker-profession"
                            style="margin-bottom: 4px;"
                        >
                            📍 ${escapeHtml(location)}
                        </p>


                        ${
                            availabilityText
                                ? `
                                    <p
                                        class="worker-profession"
                                        style="
                                            margin-bottom: 6px;
                                            font-weight: 600;
                                        "
                                    >
                                        ${escapeHtml(availabilityText)}
                                    </p>
                                `
                                : ''
                        }


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
       GET CURRENT WORKER LOCATION
       ========================================================= */

    function getCurrentLocation() {

        try {

            const raw =
                sessionStorage.getItem(
                    'handyhire.provider.profile'
                );

            if (!raw) {
                return '';
            }

            const profile =
                JSON.parse(raw);

            return String(
                profile.address || ''
            )
                .toLowerCase()
                .trim();

        } catch (error) {

            return '';
        }
    }


    /* =========================================================
       FILTER WORKERS
       ========================================================= */

    function applyFilter(filter) {

        currentFilter = filter;

        let filteredWorkers =
            [...allWorkers];


        /* =====================
           ALL
           ===================== */

        if (filter === 'all') {

            filteredWorkers =
                [...allWorkers];
        }


        /* =====================
           PRE-BOOKING
           ===================== */

        else if (filter === 'pre-booking') {

            filteredWorkers =
                allWorkers.filter(
                    function (worker) {

                        const availability =
                            String(
                                worker.availability || ''
                            )
                                .toLowerCase()
                                .trim();


                        return (
                            availability === 'pre-booking' ||
                            availability === 'both'
                        );
                    }
                );
        }


        /* =====================
           ON-SPOT
           ===================== */

        else if (filter === 'on-spot') {

            filteredWorkers =
                allWorkers.filter(
                    function (worker) {

                        const availability =
                            String(
                                worker.availability || ''
                            )
                                .toLowerCase()
                                .trim();


                        return (
                            availability === 'on-spot' ||
                            availability === 'both'
                        );
                    }
                );
        }


        /* =====================
           NEAR ME
           ===================== */

        else if (filter === 'near-me') {

            const currentLocation =
                getCurrentLocation();


            if (!currentLocation) {

                renderWorkers([]);

                return;
            }


            filteredWorkers =
                allWorkers.filter(
                    function (worker) {

                        const workerLocation =
                            String(
                                worker.location || ''
                            )
                                .toLowerCase()
                                .trim();


                        return (
                            workerLocation ===
                            currentLocation
                        );
                    }
                );
        }


        /* =====================
           BUDGET
           ===================== */

        else if (filter === 'budget') {

            filteredWorkers =
                [...allWorkers].sort(
                    function (a, b) {

                        return (
                            Number(a.price || 0) -
                            Number(b.price || 0)
                        );
                    }
                );
        }


        renderWorkers(filteredWorkers);
    }


    /* =========================================================
       ACTIVE CHIP
       ========================================================= */

    function setActiveFilter(filter) {

        const chips =
            document.querySelectorAll(
                '.filter-chips .chip'
            );


        chips.forEach(function (chip) {

            const active =
                chip.dataset.filter === filter;


            chip.classList.toggle(
                'is-active',
                active
            );


            chip.setAttribute(
                'aria-pressed',
                active ? 'true' : 'false'
            );
        });


        try {

            sessionStorage.setItem(
                FILTER_KEY,
                filter
            );

        } catch (error) {}
    }


    /* =========================================================
       FILTER CHIP CLICKS
       ========================================================= */

    function initFilterChips() {

        const chips =
            document.querySelectorAll(
                '.filter-chips .chip'
            );


        if (!chips.length) return;


        setActiveFilter('all');


        chips.forEach(function (chip) {

            chip.addEventListener(
                'click',
                function () {

                    const filter =
                        chip.dataset.filter || 'all';


                    setActiveFilter(filter);

                    applyFilter(filter);
                }
            );
        });
    }


    /* =========================================================
       LOAD ALL REGISTERED WORKERS
       ========================================================= */

    async function loadWorkers() {

        const container =
            document.getElementById(
                'serviceGrid'
            );


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


            if (response.status === 401) {

                window.HandyHireAPI.clearAuth();

                window.location.href =
                    'login.html';

                return;
            }


            if (!response.ok) {

                showMessage(
                    container,
                    'Unable to load workers.'
                );

                return;
            }


            const data =
                await response.json();


            allWorkers =
                Array.isArray(data)
                    ? data
                    : [];


            applyFilter('all');


        } catch (error) {

            console.error(
                'Failed to load workers:',
                error
            );


            showMessage(
                container,
                'Network error. Please check your backend.'
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


                if (!tile) return;


                event.preventDefault();


                const href =
                    tile.getAttribute('href');


                if (href) {
                    window.location.href = href;
                }
            }
        );
    }


    /* =========================================================
       INIT
       ========================================================= */

    function init() {

        if (!requireAuth()) {
            return;
        }


        initFilterChips();

        initPackageTiles();

        loadWorkers();
    }


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