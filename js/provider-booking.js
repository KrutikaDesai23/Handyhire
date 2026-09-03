(function () {
    'use strict';

    const DEFAULT_HOURLY_RATE = 250;

    let selectedWorker = null;
    let selectedPackage = null;
    let hourlyRate = DEFAULT_HOURLY_RATE;
    let packagePrice = 0;

    function requireProviderAuth() {
        const api = window.HandyHireAPI;

        if (
            !api ||
            typeof api.requireRole !== 'function'
        ) {
            window.location.href = 'login.html';
            return false;
        }

        return api.requireRole('worker') !== false;
    }

    function readQueryParam(name) {
        try {
            return new URLSearchParams(
                window.location.search
            ).get(name);
        } catch (error) {
            return null;
        }
    }

    function readWorkerId() {
        const fromUrl =
            readQueryParam('worker_id');

        if (fromUrl && fromUrl.trim()) {
            return fromUrl.trim();
        }

        try {
            const stored =
                sessionStorage.getItem(
                    'handyhire.selectedWorkerId'
                );

            return stored && stored.trim()
                ? stored.trim()
                : null;
        } catch (error) {
            return null;
        }
    }

    function readPackageId() {
        const fromUrl =
            readQueryParam('package_id');

        if (fromUrl && fromUrl.trim()) {
            return fromUrl.trim();
        }

        return null;
    }

    function readBookingMode() {
        return readQueryParam('booking_mode') || null;
    }

    function readStoredWorker() {
        try {
            const raw =
                sessionStorage.getItem(
                    'handyhire.bookingWorker'
                );

            if (!raw) return null;

            const worker = JSON.parse(raw);

            return (
                worker &&
                typeof worker === 'object'
            )
                ? worker
                : null;
        } catch (error) {
            return null;
        }
    }

    function saveWorker(worker) {
        try {
            sessionStorage.setItem(
                'handyhire.selectedWorkerId',
                String(worker.id)
            );

            sessionStorage.setItem(
                'handyhire.bookingWorker',
                JSON.stringify(worker)
            );
        } catch (error) {
            // Worker ID remains available in the URL.
        }
    }

    function normalizeWorker(data) {
        const worker = data || {};

        return {
            id:
                worker.id != null
                    ? String(worker.id)
                    : '',

            name:
                worker.full_name ||
                worker.name ||
                'Worker',

            profession:
                worker.profession ||
                'Professional',

            price:
                Number(worker.price) ||
                DEFAULT_HOURLY_RATE,

            profile_image:
                worker.profile_image || ''
        };
    }

    function buildAvatar(name) {
        const safeName =
            String(name || 'Worker');

        const initials = safeName
            .split(' ')
            .filter(Boolean)
            .map(function (part) {
                return part
                    .charAt(0)
                    .toUpperCase();
            })
            .slice(0, 2)
            .join('') || 'W';

        const hue =
            Array.from(safeName).reduce(
                function (sum, character) {
                    return (
                        sum +
                        character.charCodeAt(0)
                    );
                },
                0
            ) % 360;

        const svg = `
            <svg xmlns='http://www.w3.org/2000/svg'
                 viewBox='0 0 120 120'>
                <defs>
                    <linearGradient
                        id='g'
                        x1='0'
                        y1='0'
                        x2='1'
                        y2='1'
                    >
                        <stop
                            offset='0%'
                            stop-color='hsl(${hue}, 35%, 70%)'
                        />
                        <stop
                            offset='100%'
                            stop-color='hsl(${(hue + 40) % 360}, 30%, 55%)'
                        />
                    </linearGradient>
                </defs>

                <circle
                    cx='60'
                    cy='60'
                    r='60'
                    fill='url(#g)'
                />

                <text
                    x='50%'
                    y='54%'
                    text-anchor='middle'
                    font-family='Inter, sans-serif'
                    font-size='44'
                    font-weight='700'
                    fill='#ffffff'
                    dominant-baseline='middle'
                >
                    ${initials}
                </text>
            </svg>
        `.trim();

        return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
    }

    function formatRupees(amount) {
        return (
            '\u20B9' +
            Number(amount).toLocaleString(
                'en-IN'
            )
        );
    }

    function showFormError(message) {
        const errorElement =
            document.getElementById(
                'bookingFormError'
            );

        if (errorElement) {
            errorElement.textContent =
                message || '';
        }
    }

    function renderWorker(worker) {
        const avatar =
            document.getElementById(
                'workerAvatar'
            );

        const name =
            document.getElementById(
                'workerName'
            );

        const mode =
            document.getElementById(
                'workerMode'
            );

        const rateHelp =
            document.getElementById(
                'rateHelp'
            );

        if (name) {
            name.textContent = worker.name;
        }

        if (mode) {
            mode.textContent =
                worker.profession;

            mode.hidden = false;
        }

        if (avatar) {
            avatar.style.backgroundImage =
                worker.profile_image
                    ? 'url("' +
                        worker.profile_image +
                        '")'
                    : buildAvatar(worker.name);
        }

        hourlyRate =
            Number(worker.price) > 0
                ? Number(worker.price)
                : DEFAULT_HOURLY_RATE;

        if (rateHelp) {
            rateHelp.textContent =
                'Auto-calculated at ' +
                formatRupees(hourlyRate) +
                ' / hour.';
        }

        updateTotal();
    }

    async function loadWorker() {
        const workerId = readWorkerId();
        const storedWorker =
            readStoredWorker();

        if (!workerId) {
            throw new Error(
                'No worker selected. Please return and select a worker.'
            );
        }

        if (
            storedWorker &&
            String(storedWorker.id) ===
                String(workerId)
        ) {
            selectedWorker =
                normalizeWorker(
                    storedWorker
                );

            renderWorker(
                selectedWorker
            );
        }

        const response =
            await window.HandyHireAPI.apiFetch(
                '/api/workers/' +
                    encodeURIComponent(
                        workerId
                    )
            );

        if (!response.ok) {
            if (selectedWorker) return;

            throw new Error(
                'Unable to load the selected worker.'
            );
        }

        selectedWorker =
            normalizeWorker(
                await response.json()
            );

        saveWorker(selectedWorker);
        renderWorker(selectedWorker);
    }

    function renderPackage(pkg) {
        const avatar =
            document.getElementById(
                'workerAvatar'
            );

        const name =
            document.getElementById(
                'workerName'
            );

        const mode =
            document.getElementById(
                'workerMode'
            );

        const rateHelp =
            document.getElementById(
                'rateHelp'
            );

        if (name) {
            name.textContent = pkg.name || 'Team Package';
        }

        if (mode) {
            mode.textContent =
                pkg.package_type === 'team'
                    ? 'Team Package'
                    : 'Multitasking Package';

            mode.hidden = false;
        }

        if (avatar) {
            avatar.style.backgroundImage =
                buildAvatar(pkg.name || 'Team');
        }

        packagePrice =
            Number(pkg.price) > 0
                ? Number(pkg.price)
                : 0;

        hourlyRate = packagePrice;

        if (rateHelp) {
            rateHelp.textContent =
                'Package rate: ' +
                formatRupees(packagePrice) +
                ' (total = rate × hours).';
        }

        updateTotal();
    }

    function initDateAndTimeDefaults() {
        const dateInput =
            document.getElementById(
                'scheduleDate'
            );

        const timeInput =
            document.getElementById(
                'scheduleTime'
            );

        const now = new Date();

        const yyyy =
            now.getFullYear();

        const mm =
            String(
                now.getMonth() + 1
            ).padStart(2, '0');

        const dd =
            String(
                now.getDate()
            ).padStart(2, '0');

        const today =
            `${yyyy}-${mm}-${dd}`;

        if (dateInput) {
            dateInput.min = today;

            if (!dateInput.value) {
                dateInput.value = today;
            }
        }


    }

    async function loadPackage() {
        const packageId = readPackageId();

        if (!packageId) {
            throw new Error(
                'No package selected. Please return and select a package.'
            );
        }

        const response =
            await window.HandyHireAPI.apiFetch(
                '/api/packages/' +
                    encodeURIComponent(
                        packageId
                    )
            );

        if (!response.ok) {
            throw new Error(
                'Unable to load the selected package.'
            );
        }

        selectedPackage = await response.json();
        renderPackage(selectedPackage);
    }

    function initAddressDefault() {
        const addressInput =
            document.getElementById(
                'serviceAddress'
            );

        if (
            !addressInput ||
            addressInput.value
        ) {
            return;
        }

        try {
            const raw =
                sessionStorage.getItem(
                    'handyhire.provider.profile'
                );

            const profile =
                raw
                    ? JSON.parse(raw)
                    : null;

            if (profile) {
                addressInput.value =
                    profile.address ||
                    profile.location ||
                    '';
            }
        } catch (error) {
            // The provider can enter it manually.
        }
    }

    function getHours() {
        const select =
            document.getElementById(
                'hoursSelect'
            );

        return select
            ? Math.max(
                1,
                Number(select.value) || 1
            )
            : 1;
    }

    function getTotal() {
        if (selectedPackage) {
            return getHours() * packagePrice;
        }
        return getHours() * hourlyRate;
    }

    function updateTotal() {
        const total =
            document.getElementById(
                'totalCost'
            );

        if (total) {
            total.textContent =
                formatRupees(
                    getTotal()
                );
        }
    }

    function initTotalLiveUpdate() {
        const select =
            document.getElementById(
                'hoursSelect'
            );

        if (select) {
            select.addEventListener(
                'change',
                updateTotal
            );
        }

        updateTotal();
    }

    function initBackButton() {
        const back =
            document.getElementById(
                'backLink'
            );

        if (!back) return;

        try {
            const bookingBackPage =
                sessionStorage.getItem(
                    'handyhire.provider.bookingBackPage'
                );

            if (
                bookingBackPage &&
                bookingBackPage.trim()
            ) {
                back.setAttribute(
                    'href',
                    bookingBackPage.trim()
                );
            } else {
                const previousPage =
                    sessionStorage.getItem(
                        'handyhire.provider.previousPage'
                    );

                if (
                    previousPage &&
                    previousPage.trim()
                ) {
                    back.setAttribute(
                        'href',
                        previousPage.trim()
                    );
                }
            }
        } catch (error) {
            // Keep HTML fallback.
        }
    }

    async function readErrorMessage(
        response
    ) {
        try {
            const data =
                await response.json();

            const detail =
                data && data.detail;

            if (
                typeof detail === 'string'
            ) {
                return detail;
            }

            if (
                Array.isArray(detail) &&
                detail.length
            ) {
                return (
                    detail[0].msg ||
                    'Please check the booking details.'
                );
            }
        } catch (error) {
            // Use fallback below.
        }

        return (
            'Unable to create the booking. ' +
            'Please try again.'
        );
    }

    function saveBookingSummary(
        booking,
        hours
    ) {
        const summary = {
            id:
                booking.id,

            worker_id:
                booking.worker_id,

            worker:
                selectedPackage
                    ? (selectedPackage.name || 'Team Package')
                    : (booking.worker_name ||
                        selectedWorker.name),

            profession:
                selectedPackage
                    ? (selectedPackage.package_type === 'team'
                        ? 'Team Package'
                        : 'Multitasking Package')
                    : selectedWorker.profession,

            date:
                booking.booking_date,

            time:
                booking.booking_time,

            address:
                booking.address,

            hours:
                hours,

            total:
                Number(booking.amount),

            status:
                booking.status,

            package_id:
                selectedPackage
                    ? selectedPackage.id
                    : null,

            package_name:
                selectedPackage
                    ? selectedPackage.name
                    : null,

            package_type:
                selectedPackage
                    ? selectedPackage.package_type
                    : null
        };

        try {
            sessionStorage.setItem(
                'handyhire.lastBooking',
                JSON.stringify(summary)
            );
        } catch (error) {
            // Booking ID is also in the URL.
        }

        return summary;
    }

    function initBookingSubmit() {
        const form =
            document.getElementById(
                'bookingForm'
            );

        const bookButton =
            document.getElementById(
                'bookBtn'
            );

        if (!form) return;

        form.addEventListener(
            'submit',
            async function (event) {
                event.preventDefault();
                showFormError('');

                if (
                    !form.reportValidity()
                ) {
                    return;
                }

                if (
                    selectedPackage &&
                    !selectedPackage.id
                ) {
                    showFormError(
                        'The selected package could not be loaded.'
                    );

                    return;
                }

                if (
                    !selectedPackage &&
                    (!selectedWorker ||
                    !selectedWorker.id)
                ) {
                    showFormError(
                        'The selected worker could not be loaded.'
                    );

                    return;
                }

                const dateInput =
                    document.getElementById(
                        'scheduleDate'
                    );

                const timeInput =
                    document.getElementById(
                        'scheduleTime'
                    );

                const addressInput =
                    document.getElementById(
                        'serviceAddress'
                    );

                const descriptionInput =
                    document.getElementById(
                        'serviceDescription'
                    );

                const hours = getHours();

                const descriptionParts = [
                    'Duration: ' +
                    hours +
                    (
                        hours === 1
                            ? ' hour.'
                            : ' hours.'
                    )
                ];

                if (
                    descriptionInput &&
                    descriptionInput
                        .value
                        .trim()
                ) {
                    descriptionParts.push(
                        descriptionInput
                            .value
                            .trim()
                    );
                }

                const timeValue =
                    timeInput.value.length === 5
                        ? timeInput.value +
                            ':00'
                        : timeInput.value;

                const payload = {
                    package_id:
                        selectedPackage
                            ? Number(
                                selectedPackage.id
                            )
                            : null,

                    worker_id:
                        selectedPackage
                            ? null
                            : Number(
                                selectedWorker.id
                            ),

                    service_id:
                        null,

                    booking_date:
                        dateInput.value,

                    booking_time:
                        timeValue,

                    address:
                        addressInput
                            .value
                            .trim(),

                    description:
                        descriptionParts.join(
                            ' '
                        ),

                    amount:
                        getTotal(),

                    ...(selectedPackage
                        ? { hours: hours }
                        : {})
                };

                if (bookButton) {
                    bookButton.disabled = true;
                    bookButton.textContent =
                        'Booking...';
                }

                try {
                    const response =
                        await window
                            .HandyHireAPI
                            .apiFetch(
                                '/api/bookings',
                                {
                                    method:
                                        'POST',

                                    headers: {
                                        'Content-Type':
                                            'application/json'
                                    },

                                    body:
                                        JSON.stringify(
                                            payload
                                        )
                                }
                            );

                    if (!response.ok) {
                        throw new Error(
                            await readErrorMessage(
                                response
                            )
                        );
                    }

                    const booking =
                        await response.json();

                    saveBookingSummary(
                        booking,
                        hours
                    );

                    window.location.href =
                        'provider-booking-success.html?booking_id=' +
                        encodeURIComponent(
                            String(booking.id)
                        );
                } catch (error) {
                    showFormError(
                        error.message ||
                        'Unable to create the booking. Please try again.'
                    );

                    if (bookButton) {
                        bookButton.disabled =
                            false;

                        bookButton.textContent =
                            'Book';
                    }
                }
            }
        );
    }

    async function init() {
        if (!requireProviderAuth()) {
            return;
        }

        initBackButton();
        initDateAndTimeDefaults();
        initAddressDefault();
        initTotalLiveUpdate();
        initBookingSubmit();

        try {
            const mode = readBookingMode();

            if (mode === 'team' || readPackageId()) {
                await loadPackage();
            } else {
                await loadWorker();
            }
        } catch (error) {
            showFormError(error.message);

            const bookButton =
                document.getElementById(
                    'bookBtn'
                );

            if (bookButton) {
                bookButton.disabled = true;
            }
        }
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