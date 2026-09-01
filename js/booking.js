/* =========================================================
   HandyHire - Booking Page JavaScript
   Renders the worker avatar (real selection when available),
   wires up live total-cost calculation, and submits the
   booking to the FastAPI backend (POST /api/bookings).
   ========================================================= */

(function () {
    'use strict';

    /**
     * Default worker for the single-worker booking flow.
     * Used for display only when no real selection exists.
     */
    const WORKER = {
        name: 'Ravi Kumar',
    };

    /**
     * Selected package details for the package-booking flow.
     */
    let selectedPackage = null;
    const PACKAGE_HOURLY_RATE = 250;

    /**
     * Read the real backend worker ID from the URL query
     * param (?worker_id=) first, then sessionStorage.
     * @returns {string|null}
     */
    function readWorkerId() {
        try {
            const params = new URLSearchParams(window.location.search);
            const fromUrl = params.get('worker_id');
            if (fromUrl) return String(fromUrl).trim();
        } catch (e) {
            // Ignore URL errors.
        }
        try {
            const stored = sessionStorage.getItem('handyhire.selectedWorkerId');
            if (stored) return stored.trim();
        } catch (e) {
            // Ignore storage errors.
        }
        return null;
    }

    /**
     * Read the selected worker name for display. Falls back
     * to a legacy slug-aware lookup, then the default worker.
     * @returns {string}
     */
    function readWorkerName() {
        try {
            const stored = sessionStorage.getItem('handyhire.selectedWorker');
            if (stored && stored.trim()) return stored.trim();
        } catch (e) {
            // Ignore storage errors.
        }
        return WORKER.name;
    }

    /**
     * True when the current view represents a whole-team
     * booking (set by team-page.js) rather than a single worker.
     * @returns {boolean}
     */
    function isTeamBooking() {
        try {
            const mode = sessionStorage.getItem('handyhire.bookingMode');
            const team = sessionStorage.getItem('handyhire.selectedTeam');
            return (mode === 'team' && team) || (!readWorkerId() && Boolean(team));
        } catch (e) {
            return false;
        }
    }

    /**
     * Read the stored selected team (from team-package /
     * team-page). When present we show "Booking: <Team>"
     * instead of the single-worker header.
     * @returns {string|null}
     */
    function readSelectedTeam() {
        try {
            const stored = sessionStorage.getItem('handyhire.selectedTeam');
            return stored && String(stored).trim() ? stored : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Read the real backend package ID from the URL query
     * param (?package_id=).
     * @returns {string|null}
     */
    function readPackageId() {
        try {
            const params = new URLSearchParams(window.location.search);
            const fromUrl = params.get('package_id');
            if (fromUrl) return String(fromUrl).trim();
        } catch (e) {
            // Ignore URL errors.
        }
        return null;
    }

    /**
     * Read the numeric team ID from sessionStorage for API
     * calls. Returns null if no valid numeric ID is stored.
     * @returns {number|null}
     */
    function getSelectedTeamId() {
        try {
            const id = sessionStorage.getItem('handyhire.selectedTeamId');
            if (id) {
                const num = Number(id);
                if (Number.isFinite(num) && num > 0) return num;
            }
        } catch (e) {
            // Ignore storage errors.
        }
        return null;
    }

    /**
     * True when the current view represents a multitasking
     * package booking (set by multitasking-package.js).
     * @returns {boolean}
     */
    function isPackageBooking() {
        return Boolean(readPackageId());
    }

    /**
     * Render the booking subject: a multitasking package,
     * a whole team ("Booking: <Team>"), or a single worker.
     */
    function initWorkerHeader() {
        const avatar = document.getElementById('workerAvatar');
        const name = document.getElementById('workerName');
        const mode = document.getElementById('workerMode');
        const team = readSelectedTeam();

        if (isPackageBooking()) {
            if (name) name.textContent = selectedPackage ? selectedPackage.name : 'Package';
            if (mode) {
                mode.textContent = 'Booking: Package';
                mode.hidden = false;
            }
            if (avatar && selectedPackage) {
                avatar.style.backgroundImage = buildAvatar(selectedPackage.name);
            }
        } else if (team && isTeamBooking()) {
            if (name) name.textContent = team;
            if (mode) {
                mode.textContent = 'Booking: Team';
                mode.hidden = false;
            }
            if (avatar) avatar.style.backgroundImage = buildAvatar(team);
        } else {
            const displayName = readWorkerName();
            if (avatar) avatar.style.backgroundImage = buildAvatar(displayName);
            if (name) name.textContent = displayName;
            if (mode) {
                mode.hidden = true;
            }
        }
    }

    /**
     * Generate a placeholder avatar data URL so the
     * worker header renders without external image deps.
     * @param {string} name
     * @returns {string} CSS background value
     */
    function buildAvatar(name) {
        const initials = name
            .split(' ')
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase())
            .slice(0, 2)
            .join('') || 'W';

        const hue = Array.from(name).reduce(
            (sum, ch) => sum + ch.charCodeAt(0),
            0
        ) % 360;

        const svg = `
            <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'>
                <defs>
                    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
                        <stop offset='0%' stop-color='hsl(${hue}, 35%, 70%)'/>
                        <stop offset='100%' stop-color='hsl(${(hue + 40) % 360}, 30%, 55%)'/>
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
     * Format a rupee amount like 250 -> "\u20B9250".
     * @param {number} amount
     * @returns {string}
     */
    function formatRupees(amount) {
        return '\u20B9' + Number(amount).toLocaleString('en-IN');
    }

    /**
     * Set the date input's default value to today and its
     * minimum to today so past dates can't be selected.
     */
    function initDateDefaults() {
        const input = document.getElementById('scheduleDate');
        if (!input) return;

        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;

        if (!input.value) input.value = todayStr;
        input.min = todayStr;
    }

    /**
     * Read the currently selected hours, recompute the
     * total cost, and write it into the #totalCost element.
     * For package bookings the total is the fixed package
     * price; for direct-worker bookings it is hourly.
     */
    function updateTotal() {
        const select = document.getElementById('hoursSelect');
        const total = document.getElementById('totalCost');
        if (!total) return;

        if (isPackageBooking() && selectedPackage) {
            total.textContent = formatRupees(selectedPackage.price);
        } else if (select) {
            const hours = Math.max(1, Number(select.value) || 1);
            total.textContent = formatRupees(hours * PACKAGE_HOURLY_RATE);
        }
    }

    /**
     * Wire up the hour dropdown so the total updates live.
     * For package bookings the total is fixed and does not
     * change with the hours selector.
     */
    function initTotalLiveUpdate() {
        const select = document.getElementById('hoursSelect');
        if (!select) return;

        if (!isPackageBooking()) {
            select.addEventListener('change', updateTotal);
        }
        // Run once so the initial value matches the markup.
        updateTotal();
    }

    /**
     * Show a friendly inline error message on the booking page.
     * @param {string} message
     */
    function showError(message) {
        const error = document.getElementById('bookingError');
        if (!error) return;
        error.textContent = message;
        error.hidden = false;
        error.style.display = 'block';
    }

    /**
     * Clear the inline error message.
     */
    function clearError() {
        const error = document.getElementById('bookingError');
        if (!error) return;
        error.hidden = true;
        error.style.display = 'none';
    }

    /**
     * Redirect an unauthenticated customer to the login page,
     * remembering where to return afterwards.
     */
    function redirectToLogin() {
        try {
            sessionStorage.setItem('handyhire.customer.previousPage', 'booking.html');
        } catch (e) {
            // Ignore storage errors.
        }
        window.location.href = 'login.html';
    }

    /**
     * Translate an API/submit failure into a user-friendly
     * message using only safe, generic text.
     * @param {number} status
     * @returns {string}
     */
    function friendlyErrorFor(status) {
        if (status === 401) return 'Your session has expired. Please log in again.';
        if (status === 403) return 'You are not allowed to create this booking.';
        if (status === 404) return 'The selected worker could not be found.';
        if (status === 422) return 'Please check the booking details.';
        if (status === 500) return 'Unable to create your booking right now. Please try again.';
        return 'Unable to create your booking right now. Please try again.';
    }

    /**
     * Resolve the API helper (js/api.js) with a safe fallback.
     * @returns {Object}
     */
    function getApi() {
        if (window.HandyHireAPI && typeof window.HandyHireAPI.apiFetch === 'function') {
            return window.HandyHireAPI;
        }
        return null;
    }

    /**
     * Check that the customer has a stored auth token.
     * @returns {boolean}
     */
    function hasSession() {
        try {
            const token = localStorage.getItem('handyhire.auth.token');
            return Boolean(token && token.trim());
        } catch (e) {
            return false;
        }
    }

    /**
     * Build the exact POST /api/bookings body from the
     * existing form fields. Matches backend BookingCreate:
     *   worker_id|team_id, service_id?, package_id?, booking_date,
     *   booking_time, address, description?, amount
     * @param {string|null} workerId
     * @param {string} dateValue
     * @param {string} timeValue
     * @param {string} addressValue
     * @param {number} hours
     * @returns {Object}
     */
    function buildBookingPayload(workerId, dateValue, timeValue, addressValue, hours) {
        const payload = {
            booking_date: dateValue,
            booking_time: timeValue,
            address: addressValue,
            description: null,
            amount: hours * PACKAGE_HOURLY_RATE,
        };

        if (isPackageBooking() && selectedPackage) {
            payload.package_id = Number(selectedPackage.id);
            payload.amount = Number(selectedPackage.price);
        } else if (isTeamBooking()) {
            const teamId = getSelectedTeamId();
            if (teamId) {
                payload.team_id = teamId;
            }
        } else if (workerId) {
            payload.worker_id = Number(workerId);
        }

        return payload;
    }

    /**
     * Wire up the booking form's submit handler. Validates the
     * fields, submits to POST /api/bookings, then routes the
     * customer to booking-success.html with the real response.
     */
    function initBookingSubmit() {
        const form = document.getElementById('bookingForm');
        if (!form) return;

        form.addEventListener('submit', function (event) {
            event.preventDefault();
            clearError();

            if (isPackageBooking()) {
                handlePackageBooking();
                return;
            }

            const isTeam = isTeamBooking();
            const workerId = isTeam ? null : readWorkerId();

            if (!isTeam && !workerId) {
                showError('No professional selected. Please go back and choose a professional to book.');
                return;
            }

            submitWorkerBooking(workerId);
        });
    }

    /**
     * Fetch package details from the backend for the
     * selected package_id.
     */
    function fetchPackageDetails(packageId) {
        return HandyHireAPI.apiFetch('/api/packages/' + encodeURIComponent(packageId))
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('Package not found (HTTP ' + response.status + ')');
                }
                return response.json();
            });
    }

    /**
     * Handle the package-booking submit flow.
     */
    function handlePackageBooking() {
        var packageId = readPackageId();
        if (!packageId) {
            showError('No package selected. Please go back and choose a package to book.');
            return;
        }

        if (!selectedPackage) {
            fetchPackageDetails(packageId)
                .then(function (pkg) {
                    selectedPackage = pkg;
                    initWorkerHeader();
                    updateTotal();
                    submitPackageBooking(packageId);
                })
                .catch(function (error) {
                    showError('Unable to load package details. Please try again.');
                });
            return;
        }

        submitPackageBooking(packageId);
    }

    /**
     * Submit a package booking to the backend.
     * @param {string} packageId
     */
    function submitPackageBooking(packageId) {
        const dateInput = document.getElementById('scheduleDate');
        const timeInput = document.getElementById('bookingTime');
        const addressInput = document.getElementById('bookingAddress');
        const select = document.getElementById('hoursSelect');

        if (dateInput && !dateInput.value) {
            dateInput.reportValidity();
            return;
        }
        if (timeInput && !timeInput.value) {
            timeInput.reportValidity();
            return;
        }
        if (addressInput && !addressInput.value.trim()) {
            addressInput.reportValidity();
            return;
        }

        if (!(window.HandyHireAPI && window.HandyHireAPI.requireRole('customer'))) {
            return;
        }

        const api = getApi();
        if (!api) {
            showError('Booking service is unavailable right now. Please try again later.');
            return;
        }

        const hours = select ? Math.max(1, Number(select.value) || 1) : 1;
        const payload = buildBookingPayload(
            null,
            dateInput.value,
            (timeInput ? timeInput.value : '').slice(0, 10),
            addressInput ? addressInput.value.trim() : '',
            hours
        );

        const btn = document.getElementById('bookBtn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Booking...';
        }

        api.apiFetch('/api/bookings', { method: 'POST', body: JSON.stringify(payload) })
            .then(function (response) {
                if (response.status === 401) {
                    redirectToLogin();
                    throw new Error('auth');
                }
                if (!response.ok) {
                    throw { status: response.status };
                }
                return response.json();
            })
            .then(function (booking) {
                persistBookingSuccess(booking, hours, payload);
                window.location.href = 'booking-success.html';
            })
            .catch(function (err) {
                showError(friendlyErrorFor(err && err.status));
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Book';
                }
            });
    }

    /**
     * Submit a direct-worker booking to the backend.
     * @param {string} workerId
     */
    function submitWorkerBooking(workerId) {
        const dateInput = document.getElementById('scheduleDate');
        const timeInput = document.getElementById('bookingTime');
        const addressInput = document.getElementById('bookingAddress');
        const select = document.getElementById('hoursSelect');

        if (dateInput && !dateInput.value) {
            dateInput.reportValidity();
            return;
        }
        if (timeInput && !timeInput.value) {
            timeInput.reportValidity();
            return;
        }
        if (addressInput && !addressInput.value.trim()) {
            addressInput.reportValidity();
            return;
        }

        if (!(window.HandyHireAPI && window.HandyHireAPI.requireRole('customer'))) {
            return;
        }

        const api = getApi();
        if (!api) {
            showError('Booking service is unavailable right now. Please try again later.');
            return;
        }

        const hours = select ? Math.max(1, Number(select.value) || 1) : 1;
        const payload = buildBookingPayload(
            workerId,
            dateInput.value,
            (timeInput ? timeInput.value : '').slice(0, 10),
            addressInput ? addressInput.value.trim() : '',
            hours
        );

        const btn = document.getElementById('bookBtn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Booking...';
        }

        api.apiFetch('/api/bookings', { method: 'POST', body: JSON.stringify(payload) })
            .then(function (response) {
                if (response.status === 401) {
                    redirectToLogin();
                    throw new Error('auth');
                }
                if (!response.ok) {
                    throw { status: response.status };
                }
                return response.json();
            })
            .then(function (booking) {
                persistBookingSuccess(booking, hours, payload);
                window.location.href = 'booking-success.html';
            })
            .catch(function (err) {
                showError(friendlyErrorFor(err && err.status));
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Book';
                }
            });
    }

    /**
     * Persist the real backend booking response into the
     * existing handyhire.lastBooking payload so the success
     * page can read from the source of truth.
     * @param {Object} booking  backend BookingResponse or first item from list
     * @param {number} hours    duration selected on the form
     * @param {Object} payload  payload that was submitted
     */
    function persistBookingSuccess(booking, hours, payload) {
        const isTeam = isTeamBooking();
        const summary = {
            bookingId: booking && booking.id ? booking.id : null,
            workerId: booking && booking.worker_id ? booking.worker_id : null,
            workerName: isTeam ? readSelectedTeam() : (booking && booking.worker_name ? booking.worker_name : readWorkerName()),
            booking_date: (booking && booking.booking_date) || payload.booking_date,
            booking_time: (booking && booking.booking_time) || payload.booking_time,
            address: (booking && booking.address) || payload.address,
            hours: hours,
            amount: (booking && booking.amount) || payload.amount,
            total: (booking && booking.amount) || payload.amount,
            status: (booking && booking.status) || 'pending',
        };
        try {
            sessionStorage.setItem('handyhire.lastBooking', JSON.stringify(summary));
        } catch (e) {
            // Ignore storage errors (private mode etc.) -
            // navigation still works.
        }
    }

    /**
     * Set the Back button href from sessionStorage so it
     * returns to the exact previous customer page (job-hire,
     * team-page, or multitasking-package) rather than a
     * hardcoded fallback, and wire up an explicit click
     * handler so navigation always fires.
     */
    function initBackButton() {
        const back = document.getElementById('backLink');
        if (!back) return;
        try {
            const prev = sessionStorage.getItem('handyhire.customer.previousPage');
            if (prev && prev.trim()) {
                back.setAttribute('href', prev.trim());
            }
        } catch (e) {
            // Keep the HTML fallback.
        }
        back.addEventListener('click', function (event) {
            event.preventDefault();
            const href = back.getAttribute('href');
            if (href) {
                window.location.href = href;
            }
        });
    }

    /**
     * Initialize the Booking page.
     */
    function init() {
        initBackButton();
        initWorkerHeader();
        initDateDefaults();
        initTotalLiveUpdate();
        initBookingSubmit();

        if (isPackageBooking()) {
            var packageId = readPackageId();
            if (packageId) {
                fetchPackageDetails(packageId)
                    .then(function (pkg) {
                        selectedPackage = pkg;
                        initWorkerHeader();
                        updateTotal();
                    })
                    .catch(function () {
                        showError('Unable to load package details. Please go back and try again.');
                    });
            }
        }
    }

    // Run after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
