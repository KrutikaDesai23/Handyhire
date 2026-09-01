(function () {
    'use strict';

    const GROUP_TITLES = {
        today: 'Today',
        yesterday: 'Yesterday',
        older: 'Earlier'
    };

    const MODES = {
        received: {
            endpoint: '/api/worker/bookings',
            personLabel: 'Booked by',
            empty:
                'No jobs received yet. Bookings made for you will appear here.'
        },

        sent: {
            endpoint:
                '/api/worker/bookings/sent',

            personLabel:
                'Worker',

            empty:
                'You have not hired any workers yet.'
        }
    };

    const STATUSES = {
        pending: [
            'Pending',
            'booking-status--pending'
        ],

        accepted: [
            'Accepted',
            'booking-status--confirmed'
        ],

        confirmed: [
            'Confirmed',
            'booking-status--confirmed'
        ],

        rejected: [
            'Rejected',
            'booking-status--cancelled'
        ],

        declined: [
            'Declined',
            'booking-status--cancelled'
        ],

        cancelled: [
            'Cancelled',
            'booking-status--cancelled'
        ],

        completed: [
            'Completed',
            'booking-status--completed'
        ],

        completion_requested: [
            'Awaiting customer confirmation',
            'booking-status--pending'
        ]
    };

    const ACTIONS = {
        pending: [
            [
                'accept',
                'Accept',
                'booking-action-btn--accept'
            ],
            [
                'reject',
                'Reject',
                'booking-action-btn--reject'
            ]
        ],

        accepted: [
            [
                'request_completion',
                'Request Completion',
                'booking-action-btn--complete'
            ],
            [
                'cancel',
                'Cancel',
                'booking-action-btn--cancel'
            ]
        ]
    };

    const ACTION_STATUS = {
        accept: 'accepted',
        reject: 'rejected',
        request_completion: 'completion_requested',
        cancel: 'cancelled'
    };

    let activeMode = 'received';
    let loadedBookings = [];
    let loadVersion = 0;

    function getApi() {
        const api =
            window.HandyHireAPI;

        return (
            api &&
            typeof api.apiFetch === 'function'
        )
            ? api
            : null;
    }

    function redirectToLogin() {
        try {
            sessionStorage.setItem(
                'handyhire.provider.previousPage',
                'provider-activity.html'
            );
        } catch (error) {
            // Continue to login.
        }

        window.location.href =
            'login.html';
    }

    function escapeHtml(value) {
        return String(
            value == null ? '' : value
        )
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function parseDate(value) {
        if (!value) return null;

        const parts =
            String(value)
                .split('-')
                .map(Number);

        if (
            parts.length === 3 &&
            parts.every(Number.isFinite)
        ) {
            return new Date(
                parts[0],
                parts[1] - 1,
                parts[2]
            );
        }

        const date = new Date(value);

        return isNaN(date.getTime())
            ? null
            : date;
    }

    function sameDay(
        first,
        second
    ) {
        return (
            first.getFullYear() ===
                second.getFullYear() &&

            first.getMonth() ===
                second.getMonth() &&

            first.getDate() ===
                second.getDate()
        );
    }

    function getGroup(date) {
        if (!date) return 'older';

        const today = new Date();

        if (sameDay(date, today)) {
            return 'today';
        }

        const yesterday =
            new Date(today);

        yesterday.setDate(
            today.getDate() - 1
        );

        return sameDay(
            date,
            yesterday
        )
            ? 'yesterday'
            : 'older';
    }

    function formatDate(date) {
        if (!date) return '--';

        const months = [
            'Jan',
            'Feb',
            'Mar',
            'Apr',
            'May',
            'Jun',
            'Jul',
            'Aug',
            'Sep',
            'Oct',
            'Nov',
            'Dec'
        ];

        const today = new Date();

        const yesterday =
            new Date(today);

        yesterday.setDate(
            today.getDate() - 1
        );

        const normal =
            date.getDate() +
            ' ' +
            months[date.getMonth()] +
            ' ' +
            date.getFullYear();

        if (sameDay(date, today)) {
            return (
                'Today, ' +
                date.getDate() +
                ' ' +
                months[date.getMonth()]
            );
        }

        if (
            sameDay(
                date,
                yesterday
            )
        ) {
            return (
                'Yesterday, ' +
                date.getDate() +
                ' ' +
                months[date.getMonth()]
            );
        }

        return normal;
    }

    function formatTime(value) {
        const text =
            String(value || '').trim();

        const match = text.match(
            /^(\d{1,2}):(\d{2})(?::\d{2})?$/
        );

        if (!match) {
            return text || '--';
        }

        let hour =
            parseInt(match[1], 10);

        const suffix =
            hour >= 12
                ? 'PM'
                : 'AM';

        hour = hour % 12 || 12;

        return (
            hour +
            ':' +
            match[2] +
            ' ' +
            suffix
        );
    }

    function formatPrice(value) {
        const amount =
            Number(value);

        return Number.isFinite(amount)
            ? (
                '\u20B9' +
                amount.toLocaleString(
                    'en-IN'
                )
            )
            : '--';
    }

    function mapBooking(
        booking,
        mode
    ) {
        const statusKey =
            String(
                booking.status ||
                'pending'
            ).toLowerCase();

        const status =
            STATUSES[statusKey] || [
                booking.status ||
                    'Pending',

                'booking-status--pending'
            ];

        const date =
            parseDate(
                booking.booking_date
            );

        const packageId = booking.package_id || null;
        const packageName = booking.package_name || null;
        const packageType = booking.package_type || null;
        const isPackage = Boolean(packageId);
        const bookingType = isPackage ? 'package' : 'individual';

        let typeLabel = 'INDIVIDUAL BOOKING';
        if (isPackage) {
            if (packageType === 'team') {
                typeLabel = 'TEAM PACKAGE';
            } else if (packageType === 'multitasking') {
                typeLabel = 'MULTITASKING PACKAGE';
            } else {
                typeLabel = 'MULTITASKING PACKAGE';
            }
        }

        return {
            id:
                booking.id,

            mode:
                mode,

            personLabel:
                MODES[mode].personLabel,

            name:
                mode === 'sent'
                    ? (
                        booking.worker_name ||
                        '--'
                    )
                    : (
                        booking.customer_name ||
                        '--'
                    ),

            occupation:
                isPackage
                    ? (packageName || (packageType === 'team' ? 'Team Package' : 'Multitasking Package'))
                    : (
                        booking.service_name ||
                        (
                            mode === 'sent'
                                ? 'Worker hired'
                                : 'Job booking'
                        )
                    ),

            service_name:
                booking.service_name,

            bookingType:
                bookingType,

            typeLabel:
                typeLabel,

            packageId:
                packageId,

            packageName:
                packageName,

            statusKey:
                statusKey,

            status:
                status[0],

            statusCss:
                status[1],

            date:
                formatDate(date),

            time:
                formatTime(
                    booking.booking_time
                ),

            group:
                getGroup(date),

            amount:
                Number(
                    booking.amount
                ),

            address:
                booking.address ||
                '--',

            description:
                booking.description ||
                ''
        };
    }

    function getCurrentWorkerId() {
        const user = window.HandyHireAPI.getCurrentUser();
        if (user && user.id) return String(user.id);
        return null;
    }

    function renderActions(
        booking
    ) {
        if (
            booking.mode !==
            'received'
        ) {
            return '';
        }

        const currentWorkerId = getCurrentWorkerId();
        const isLead = currentWorkerId && String(booking.worker_id) === currentWorkerId;

        if (!isLead && booking.bookingType === 'package') {
            return '<div class="booking-readonly-notice">Read-only team booking</div>';
        }

        const actions =
            ACTIONS[
                booking.statusKey
            ];

        if (!actions) return '';

        return (
            "<div class='booking-actions'>" +

            actions.map(
                function (action) {
                    return (
                        "<button type='button' " +

                        "class='booking-action-btn " +
                        escapeHtml(action[2]) +
                        "' " +

                        "data-action='" +
                        escapeHtml(action[0]) +
                        "' " +

                        "data-id='" +
                        escapeHtml(booking.id) +
                        "'>" +

                        escapeHtml(action[1]) +

                        "</button>"
                    );
                }
            ).join('') +

            '</div>'
        );
    }

    function renderCard(
        booking
    ) {
        const description =
            booking.description
                ? (
                    "<p class='booking-description'>" +
                        escapeHtml(
                            booking.description
                        ) +
                        '</p>'
                )
                : '';

        const typeLabel = booking.typeLabel || (
            booking.bookingType === 'package'
                ? 'MULTITASKING PACKAGE'
                : 'INDIVIDUAL BOOKING'
        );

        const typeBadge =
            "<span class='booking-type-badge booking-type-badge--" + escapeHtml(booking.bookingType || 'individual') + "'>" +
                escapeHtml(typeLabel) +
            '</span>';

        return `
            <article
                class="booking-card"
                data-booking-id="${escapeHtml(booking.id)}"
            >
                <p class="booking-direction">
                    ${escapeHtml(booking.personLabel)}
                </p>

                <div class="booking-top">
                    <div>
                        <p class="booking-name">
                            ${escapeHtml(booking.name)}
                        </p>

                        <p class="booking-occupation">
                            ${escapeHtml(booking.occupation)}
                        </p>
                    </div>

                    <div class="booking-badges">
                        ${typeBadge}
                        <span class="booking-status ${escapeHtml(booking.statusCss)}">
                            ${escapeHtml(booking.status)}
                        </span>
                    </div>
                </div>

                <div class="booking-meta">
                    <span>
                        <span class="meta-label">
                            Date:
                        </span>

                        <span class="meta-value">
                            ${escapeHtml(booking.date)}
                        </span>
                    </span>

                    <span>
                        <span class="meta-label">
                            Time:
                        </span>

                        <span class="meta-value">
                            ${escapeHtml(booking.time)}
                        </span>
                    </span>
                </div>

                <div class="booking-meta">
                    <span>
                        <span class="meta-label">
                            Amount:
                        </span>

                        <span class="meta-value">
                            ${escapeHtml(formatPrice(booking.amount))}
                        </span>
                    </span>
                </div>

                ${description}
                ${renderActions(booking)}
            </article>
        `.trim();
    }

    function renderSection(
        group,
        bookings
    ) {
        if (!bookings.length) {
            return '';
        }

        return `
            <section class="section-group">
                <h2 class="section-title">
                    ${GROUP_TITLES[group]}
                </h2>

                ${bookings.map(renderCard).join('')}
            </section>
        `.trim();
    }

    function matchesSearch(
        booking,
        search
    ) {
        return (
            booking.name
                .toLowerCase()
                .includes(search) ||

            booking.occupation
                .toLowerCase()
                .includes(search) ||

            booking.status
                .toLowerCase()
                .includes(search) ||

            booking.date
                .toLowerCase()
                .includes(search) ||

            booking.time
                .toLowerCase()
                .includes(search) ||

            booking.address
                .toLowerCase()
                .includes(search) ||

            booking.description
                .toLowerCase()
                .includes(search) ||

            String(
                booking.amount
            ).includes(search)
        );
    }

    function showMessage(message) {
        const feed =
            document.getElementById(
                'activityFeed'
            );

        const empty =
            document.getElementById(
                'emptyState'
            );

        if (feed) {
            feed.innerHTML = '';
        }

        if (empty) {
            empty.textContent =
                message;

            empty.hidden = false;
        }
    }

    function render() {
        const feed =
            document.getElementById(
                'activityFeed'
            );

        const empty =
            document.getElementById(
                'emptyState'
            );

        const searchInput =
            document.getElementById(
                'activitySearch'
            );

        if (!feed) return;

        const search =
            String(
                searchInput
                    ? searchInput.value
                    : ''
            )
                .trim()
                .toLowerCase();

        const visible =
            search
                ? loadedBookings.filter(
                    function (booking) {
                        return matchesSearch(
                            booking,
                            search
                        );
                    }
                )
                : loadedBookings.slice();

        if (!visible.length) {
            showMessage(
                search
                    ? 'No activity matches your search.'
                    : MODES[activeMode].empty
            );

            return;
        }

        const groups = {
            today: [],
            yesterday: [],
            older: []
        };

        visible.forEach(
            function (booking) {
                groups[
                    booking.group
                ].push(booking);
            }
        );

        feed.innerHTML = [
            'today',
            'yesterday',
            'older'
        ]
            .map(function (group) {
                return renderSection(
                    group,
                    groups[group]
                );
            })
            .filter(Boolean)
            .join('');

        if (empty) {
            empty.hidden = true;
        }
    }

    async function loadBookings() {
        const api = getApi();

        if (!api) {
            showMessage(
                'Booking service is unavailable.'
            );

            return;
        }

        const requestedMode =
            activeMode;

        const version =
            ++loadVersion;

        showMessage(
            'Loading activity...'
        );

        try {
            const response =
                await api.apiFetch(
                    MODES[
                        requestedMode
                    ].endpoint
                );

            if (
                version !==
                    loadVersion ||

                requestedMode !==
                    activeMode
            ) {
                return;
            }

            if (
                response.status === 401
            ) {
                redirectToLogin();
                return;
            }

            if (
                response.status === 403
            ) {
                showMessage(
                    'You are not allowed to view this activity.'
                );

                return;
            }

            if (!response.ok) {
                showMessage(
                    'Unable to load activity. Please try again.'
                );

                return;
            }

            const data =
                await response.json();

            loadedBookings = (
                Array.isArray(data)
                    ? data
                    : []
            ).map(function (booking) {
                return mapBooking(
                    booking,
                    requestedMode
                );
            });

            render();
        } catch (error) {
            if (
                version ===
                    loadVersion &&

                requestedMode ===
                    activeMode
            ) {
                showMessage(
                    'Unable to connect to HandyHire.'
                );
            }
        }
    }

    async function updateStatus(
        bookingId,
        newStatus
    ) {
        if (
            activeMode !==
            'received'
        ) {
            return;
        }

        const api = getApi();

        if (!api) return;

        const endpoint =
            '/api/worker/bookings/' +

            encodeURIComponent(
                String(bookingId)
            ) +

            '/status?new_status=' +

            encodeURIComponent(
                newStatus
            );

        try {
            const response =
                await api.apiFetch(
                    endpoint,
                    {
                        method: 'PUT'
                    }
                );

            if (
                response.status === 401
            ) {
                redirectToLogin();
                return;
            }

            if (!response.ok) {
                showMessage(
                    'This booking could not be updated.'
                );

                return;
            }

            const updated =
                await response.json();

            const index =
                loadedBookings.findIndex(
                    function (booking) {
                        return (
                            String(
                                booking.id
                            ) ===

                            String(
                                updated.id
                            )
                        );
                    }
                );

            if (index >= 0) {
                loadedBookings[index] =
                    mapBooking(
                        updated,
                        'received'
                    );
            }

            render();
        } catch (error) {
            showMessage(
                'Unable to connect to HandyHire.'
            );
        }
    }

    function selectMode(mode) {
        if (
            !MODES[mode] ||
            mode === activeMode
        ) {
            return;
        }

        activeMode = mode;
        loadedBookings = [];

        document
            .querySelectorAll(
                '[data-mode]'
            )
            .forEach(function (tab) {
                const selected =
                    tab.dataset.mode ===
                    activeMode;

                tab.classList.toggle(
                    'is-active',
                    selected
                );

                tab.setAttribute(
                    'aria-selected',
                    selected
                        ? 'true'
                        : 'false'
                );
            });

        const search =
            document.getElementById(
                'activitySearch'
            );

        if (search) {
            search.value = '';

            search.placeholder =
                activeMode === 'sent'
                    ? 'Search workers hired'
                    : 'Search jobs received';
        }

        loadBookings();
    }

    function init() {
        const api =
            window.HandyHireAPI;

        if (
            !api ||
            api.requireRole(
                'worker'
            ) === false
        ) {
            return;
        }

        const tabs =
            document.getElementById(
                'activityModeTabs'
            );

        const search =
            document.getElementById(
                'activitySearch'
            );

        const feed =
            document.getElementById(
                'activityFeed'
            );

        if (tabs) {
            tabs.addEventListener(
                'click',
                function (event) {
                    const button =
                        event.target.closest(
                            '[data-mode]'
                        );

                    if (
                        button &&
                        tabs.contains(button)
                    ) {
                        selectMode(
                            button.dataset.mode
                        );
                    }
                }
            );
        }

        if (search) {
            search.addEventListener(
                'input',
                render
            );
        }

        if (feed) {
            feed.addEventListener(
                'click',
                function (event) {
                    const button =
                        event.target.closest(
                            '[data-action]'
                        );

                    if (
                        !button ||
                        !feed.contains(button)
                    ) {
                        return;
                    }

                    const nextStatus =
                        ACTION_STATUS[
                            button.dataset.action
                        ];

                    if (!nextStatus) {
                        return;
                    }

                    button.disabled =
                        true;

                    button.textContent +=
                        '...';

                    updateStatus(
                        button.dataset.id,
                        nextStatus
                    );
                }
            );
        }

        loadBookings();
    }

    if (
        document.readyState ===
        'loading'
    ) {
        document.addEventListener(
            'DOMContentLoaded',
            init
        );
    } else {
        init();
    }
})();