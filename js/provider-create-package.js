/* =========================================================
   HandyHire - Provider Create Package
   Multitasking + Team Package create/edit
   ========================================================= */

(function () {
    'use strict';

    const api = window.HandyHireAPI;

    if (!api) {
        console.error('HandyHireAPI is not loaded.');
        return;
    }

    let services = [];
    let allWorkers = [];

    let selectedServiceIds = [];
    let selectedWorkerIds = [];
    let selectedLeaderWorkerId = null;

    let isEditMode = false;
    let packageType = 'multitasking';
    let dropdownOpen = false;

    /* =====================================================
       QUERY PARAMS
       ===================================================== */

    function getQueryParams() {
        const params = new URLSearchParams(window.location.search);

        return {
            type: params.get('type'),
            package_id: params.get('package_id')
        };
    }

    /* =====================================================
       HELPERS
       ===================================================== */

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function showFieldError(id, message) {
        const element = document.getElementById(id);

        if (!element) return;

        if (message) {
            element.textContent = message;
            element.hidden = false;
        } else {
            element.textContent = '';
            element.hidden = true;
        }
    }

    function showFormError(message) {
        const element = document.getElementById('formError');

        if (!element) return;

        if (message) {
            element.textContent = message;
            element.hidden = false;
        } else {
            element.textContent = '';
            element.hidden = true;
        }
    }

    function clearErrors() {
        [
            'nameError',
            'descriptionError',
            'teamError',
            'servicesError',
            'durationError',
            'priceError',
            'locationError',
            'availabilityError',
            'statusError'
        ].forEach(function (id) {
            showFieldError(id, '');
        });

        showFormError('');
    }

    function setSubmitting(disabled, label) {
        const button = document.getElementById('submitBtn');

        if (!button) return;

        button.disabled = disabled;
        button.textContent = label || 'Save Package';
    }

function redirectToPackagePage() {
    if (packageType === 'team') {
        window.location.href =
            'provider-team-package.html?tab=mine';
    } else {
        window.location.href =
            'provider-multitasking-package.html';
    }
}
    function getCurrentUserId() {
        const user = api.getCurrentUser();

        if (!user) {
            return null;
        }

        return Number(user.id || user.user_id) || null;
    }

    /* =====================================================
       PACKAGE TYPE UI
       ===================================================== */

    function configurePackageType() {
        const typeInput = document.getElementById('packageType');
        const teamField = document.getElementById('teamFieldGroup');
        const servicesField = document.getElementById('servicesFieldGroup');

        if (typeInput) {
            typeInput.value = packageType;
        }

        /*
         * TEAM PACKAGE:
         * show worker selector
         * hide services
         */
        if (teamField) {
            teamField.hidden = packageType !== 'team';
        }

        /*
         * MULTITASKING:
         * show services
         *
         * TEAM:
         * services not required
         */
        if (servicesField) {
            servicesField.hidden = packageType === 'team';
        }
    }

    /* =====================================================
       SERVICES - MULTITASKING ONLY
       ===================================================== */

    function loadServices() {
        return api.apiFetch('/api/services')
            .then(function (response) {
                if (response.status === 401 || response.status === 403) {
                    api.clearAuth();
                    window.location.href = 'login.html';
                    return null;
                }

                if (!response.ok) {
                    throw new Error('Failed to load services.');
                }

                return response.json();
            });
    }

    function populateServiceSelect() {
        const select = document.getElementById('serviceSelect');

        if (!select) return;

        select.innerHTML =
            '<option value="">Add a service</option>';

        services.forEach(function (service) {
            const option = document.createElement('option');

            option.value = String(service.id);

            option.textContent = service.category
                ? service.name + ' (' + service.category + ')'
                : service.name;

            select.appendChild(option);
        });
    }

    function renderSelectedServices() {
        const list = document.getElementById('selectedServices');

        if (!list) return;

        list.innerHTML = selectedServiceIds
            .map(function (serviceId) {
                const service = services.find(function (item) {
                    return Number(item.id) === Number(serviceId);
                });

                const label = service
                    ? service.name
                    : 'Service ' + serviceId;

                return (
                    '<li class="service-tag">' +
                        '<span>' +
                            escapeHtml(label) +
                        '</span>' +
                        '<button ' +
                            'type="button" ' +
                            'class="service-tag-remove" ' +
                            'data-id="' + serviceId + '" ' +
                            'aria-label="Remove ' +
                                escapeHtml(label) +
                            '">' +
                            '&times;' +
                        '</button>' +
                    '</li>'
                );
            })
            .join('');
    }

    function addService() {
        const select = document.getElementById('serviceSelect');

        if (!select) return;

        const serviceId = Number(select.value);

        if (!serviceId) return;

        if (!selectedServiceIds.includes(serviceId)) {
            selectedServiceIds.push(serviceId);
        }

        select.value = '';

        renderSelectedServices();
        showFieldError('servicesError', '');
    }

    function removeService(serviceId) {
        selectedServiceIds = selectedServiceIds.filter(
            function (id) {
                return Number(id) !== Number(serviceId);
            }
        );

        renderSelectedServices();
    }

    /* =====================================================
       REGISTERED WORKERS - TEAM PACKAGE
       ===================================================== */

    function loadWorkers() {
        return api.apiFetch('/api/workers')
            .then(function (response) {
                if (response.status === 401 || response.status === 403) {
                    api.clearAuth();
                    window.location.href = 'login.html';
                    return null;
                }

                if (!response.ok) {
                    throw new Error('Failed to load workers.');
                }

                return response.json();
            });
    }

    function normalizeWorker(worker) {
        const profile = worker.worker_profile || {};

        return {
            id: Number(worker.id || worker.worker_id),
            full_name:
                worker.full_name ||
                worker.name ||
                'Worker',
            profession:
                worker.profession ||
                profile.profession ||
                worker.skill ||
                ''
        };
    }

    function prepareWorkers(data) {
        const currentUserId = getCurrentUserId();
        const seen = new Set();

        allWorkers = (Array.isArray(data) ? data : [])
            .map(normalizeWorker)
            .filter(function (worker) {
                if (!worker.id) return false;

                /*
                 * Do not allow provider
                 * to select themselves.
                 */
                if (
                    currentUserId &&
                    Number(worker.id) === Number(currentUserId)
                ) {
                    return false;
                }

                if (seen.has(worker.id)) {
                    return false;
                }

                seen.add(worker.id);

                return true;
            });
    }

    function getWorkerById(workerId) {
        return allWorkers.find(function (worker) {
            return Number(worker.id) === Number(workerId);
        });
    }

    /* =====================================================
       WORKER AUTOCOMPLETE
       ===================================================== */

    function openDropdown() {
        const dropdown =
            document.getElementById('workerDropdown');

        if (!dropdown) return;

        dropdown.hidden = false;
        dropdownOpen = true;
    }

    function closeDropdown() {
        const dropdown =
            document.getElementById('workerDropdown');

        if (!dropdown) return;

        dropdown.hidden = true;
        dropdownOpen = false;
    }

    function renderWorkerDropdown() {
        const input =
            document.getElementById('workerSearchInput');

        const list =
            document.getElementById('workerDropdownList');

        if (!input || !list) return;

        const query =
            input.value.trim().toLowerCase();

        /*
         * User wanted compact field when
         * nothing is being searched.
         */
        if (!query) {
            list.innerHTML = '';
            closeDropdown();
            return;
        }

        const matches = allWorkers.filter(function (worker) {
            if (
                selectedWorkerIds.includes(
                    Number(worker.id)
                )
            ) {
                return false;
            }

            const name =
                String(worker.full_name || '')
                    .toLowerCase();

            const profession =
                String(worker.profession || '')
                    .toLowerCase();

            return (
                name.includes(query) ||
                profession.includes(query)
            );
        });

        if (matches.length === 0) {
            list.innerHTML =
                '<div class="autocomplete-empty">' +
                    'No matching workers.' +
                '</div>';

            openDropdown();
            return;
        }

        list.innerHTML = matches
            .slice(0, 20)
            .map(function (worker) {
                return (
                    '<button ' +
                        'type="button" ' +
                        'class="worker-option" ' +
                        'data-worker-id="' +
                        worker.id +
                        '">' +

                        '<span class="worker-option-name">' +
                            escapeHtml(worker.full_name) +
                        '</span>' +

                        (
                            worker.profession
                                ? '<span class="worker-option-profession">' +
                                    escapeHtml(worker.profession) +
                                  '</span>'
                                : ''
                        ) +

                    '</button>'
                );
            })
            .join('');

        openDropdown();
    }

    function renderSelectedWorkers() {
        const container =
            document.getElementById('workerSelectedChips');

        if (!container) return;

        if (selectedWorkerIds.length === 0) {
            container.innerHTML = '';
            return;
        }

        const chips = selectedWorkerIds
            .map(function (workerId) {
                const worker = getWorkerById(workerId);

                if (!worker) return '';

                const profession = worker.profession
                    ? ' • ' + escapeHtml(worker.profession)
                    : '';

                const isLeader =
                    selectedLeaderWorkerId !== null &&
                    Number(selectedLeaderWorkerId) ===
                        Number(workerId);

                const leaderButton = isLeader
                    ? '<button type="button" class="worker-chip-leader is-leader" data-worker-id="' +
                      worker.id +
                      '" aria-label="Remove leader">✓ Leader</button>'
                    : '<button type="button" class="worker-chip-leader" data-worker-id="' +
                      worker.id +
                      '" aria-label="Set as leader">Set as leader</button>';

                return (
                    '<div class="worker-selected-chip">' +

                        '<span>' +
                            escapeHtml(worker.full_name) +
                            profession +
                        '</span>' +

                        leaderButton +

                        '<button ' +
                            'type="button" ' +
                            'class="worker-chip-remove" ' +
                            'data-worker-id="' +
                            worker.id +
                            '" ' +
                            'aria-label="Remove ' +
                            escapeHtml(worker.full_name) +
                            '">' +
                            '&times;' +
                        '</button>' +

                    '</div>'
                );
            })
            .join('');

        const count =
            selectedWorkerIds.length;

        container.innerHTML =
            chips +
            '<div class="worker-selected-count">' +
                count +
                ' member' +
                (count === 1 ? '' : 's') +
                ' selected' +
            '</div>';
    }

    function selectWorker(workerId) {
        workerId = Number(workerId);

        if (!workerId) return;

        if (!selectedWorkerIds.includes(workerId)) {
            selectedWorkerIds.push(workerId);
        }

        renderSelectedWorkers();

        showFieldError('teamError', '');

        const input =
            document.getElementById('workerSearchInput');

        if (input) {
            input.value = '';
            input.focus();
        }

        closeDropdown();
    }

    function removeWorker(workerId) {
        selectedWorkerIds =
            selectedWorkerIds.filter(function (id) {
                return Number(id) !== Number(workerId);
            });

        if (
            selectedLeaderWorkerId !== null &&
            Number(selectedLeaderWorkerId) === Number(workerId)
        ) {
            selectedLeaderWorkerId = null;
        }

        renderSelectedWorkers();
    }

    /* =====================================================
       VALIDATION
       ===================================================== */

    function validateForm(payload) {
        clearErrors();

        let valid = true;

        if (!payload.name) {
            showFieldError(
                'nameError',
                'Package name is required.'
            );

            valid = false;
        }

        /*
         * MULTITASKING:
         * One provider, multiple services.
         */
        if (
            payload.package_type === 'multitasking' &&
            selectedServiceIds.length < 2
        ) {
            showFieldError(
                'servicesError',
                'Please add at least two services for a multitasking package.'
            );

            valid = false;
        }

        /*
         * TEAM PACKAGE:
         * Minimum 2 registered workers.
         */
        if (
            payload.package_type === 'team' &&
            selectedWorkerIds.length < 2
        ) {
            showFieldError(
                'teamError',
                'Please select at least 2 workers.'
            );

            valid = false;
        }

        /*
         * TEAM PACKAGE:
         * Must have exactly one leader.
         */
        if (
            payload.package_type === 'team' &&
            selectedLeaderWorkerId === null
        ) {
            showFieldError(
                'teamError',
                'Select a team leader.'
            );

            valid = false;
        }

        if (
            !payload.price ||
            Number(payload.price) <= 0
        ) {
            showFieldError(
                'priceError',
                'Price must be greater than ₹0.'
            );

            valid = false;
        }

        return valid;
    }

    /* =====================================================
       BUILD PAYLOAD
       ===================================================== */

    function buildPayload() {
        const name =
            document
                .getElementById('packageName')
                .value
                .trim();

        const description =
            document
                .getElementById('packageDescription')
                .value
                .trim();

        const duration =
            document
                .getElementById('packageDuration')
                .value
                .trim();

        const location =
            document
                .getElementById('packageLocation')
                .value
                .trim();

        const availability =
            document
                .getElementById('packageAvailability')
                .value
                .trim();

        const statusElement =
            document.getElementById('packageStatus');

        return {
            name: name,

            description:
                description || null,

            package_type:
                packageType,

            price:
                Number(
                    document.getElementById(
                        'packagePrice'
                    ).value
                ) || 0,

            duration:
                duration || null,

            location:
                location || null,

            availability:
                availability || null,

  status:
    packageType === 'team'
        ? 'published'
        : (
            statusElement
                ? statusElement.value
                : 'draft'
        ),
            /*
             * TEAM packages no longer
             * manually select services.
             */
            service_ids:
                packageType === 'team'
                    ? []
                    : selectedServiceIds.slice(),

            worker_ids:
                packageType === 'team'
                    ? selectedWorkerIds.slice()
                    : [],

            leader_worker_id:
                packageType === 'team'
                    ? selectedLeaderWorkerId
                    : null
        };
    }

    /* =====================================================
       BACKEND ERROR
       ===================================================== */

    function getBackendError(response) {
        return response
            .json()
            .then(function (errorData) {
                if (!errorData) {
                    return 'Failed to save package.';
                }

                if (Array.isArray(errorData.detail)) {
                    return errorData.detail
                        .map(function (error) {
                            if (error && error.msg) {
                                return error.msg;
                            }

                            return String(error);
                        })
                        .join(', ');
                }

                if (errorData.detail) {
                    return String(errorData.detail);
                }

                if (errorData.message) {
                    return String(errorData.message);
                }

                return 'Failed to save package.';
            })
            .catch(function () {
                return (
                    'Failed to save package. ' +
                    'Server returned status ' +
                    response.status +
                    '.'
                );
            });
    }

    /* =====================================================
       SAVE
       ===================================================== */

    function handleSubmit(event) {
        event.preventDefault();

        clearErrors();

        const payload = buildPayload();

        if (!validateForm(payload)) {
            return;
        }

        const packageId =
            document.getElementById('packageId').value;

        const isCreate = !packageId;

        const url = isCreate
            ? '/api/worker/packages'
            : '/api/worker/packages/' + packageId;

        const method = isCreate
            ? 'POST'
            : 'PUT';

        setSubmitting(
            true,
            isCreate ? 'Saving...' : 'Updating...'
        );

        api.apiFetch(url, {
            method: method,
            body: JSON.stringify(payload)
        })
            .then(function (response) {
                if (
                    response.status === 401 ||
                    response.status === 403
                ) {
                    api.clearAuth();
                    window.location.href = 'login.html';
                    return null;
                }

                if (!response.ok) {
                    return getBackendError(response)
                        .then(function (message) {
                            throw new Error(message);
                        });
                }

                return response.json();
            })
            .then(function (data) {
                if (!data) return;

                redirectToPackagePage();
            })
            .catch(function (error) {
                console.error(
                    'Package save error:',
                    error
                );

                showFormError(
                    error && error.message
                        ? error.message
                        : 'Failed to save package.'
                );

                setSubmitting(
                    false,
                    isEditMode
                        ? 'Update Package'
                        : 'Save Package'
                );
            });
    }

    /* =====================================================
       EDIT PACKAGE
       ===================================================== */

    function loadPackage(packageId) {
        setSubmitting(true, 'Loading...');

        return api.apiFetch(
            '/api/worker/packages/' + packageId
        )
            .then(function (response) {
                if (
                    response.status === 401 ||
                    response.status === 403
                ) {
                    api.clearAuth();
                    window.location.href = 'login.html';
                    return null;
                }

                if (!response.ok) {
                    throw new Error(
                        'Failed to load package.'
                    );
                }

                return response.json();
            })
            .then(function (data) {
                if (!data) return;

                packageType =
                    data.package_type || packageType;

                configurePackageType();

                document.getElementById(
                    'packageName'
                ).value = data.name || '';

                document.getElementById(
                    'packageDescription'
                ).value = data.description || '';

                document.getElementById(
                    'packagePrice'
                ).value = data.price || '';

                document.getElementById(
                    'packageDuration'
                ).value = data.duration || '';

                document.getElementById(
                    'packageLocation'
                ).value = data.location || '';

                document.getElementById(
                    'packageAvailability'
                ).value = data.availability || '';

                const statusElement =
                    document.getElementById(
                        'packageStatus'
                    );

                if (statusElement) {
                    statusElement.value =
                        data.status || 'draft';
                }

                if (
                    packageType === 'multitasking' &&
                    Array.isArray(data.services)
                ) {
                    selectedServiceIds =
                        data.services.map(
                            function (service) {
                                return Number(service.id);
                            }
                        );

                    renderSelectedServices();
                }

                if (
                    packageType === 'team' &&
                    Array.isArray(data.workers)
                ) {
                    selectedWorkerIds =
                        data.workers.map(
                            function (worker) {
                                return Number(
                                    worker.worker_id ||
                                    worker.id
                                );
                            }
                        )
                        .filter(Boolean);

                    /*
                     * If edit response contains a worker
                     * missing from /api/workers, add it
                     * so its chip can still render.
                     */
                    data.workers.forEach(function (worker) {
                        const workerId =
                            Number(
                                worker.worker_id ||
                                worker.id
                            );

                        if (
                            workerId &&
                            !getWorkerById(workerId)
                        ) {
                            allWorkers.push({
                                id: workerId,
                                full_name:
                                    worker.full_name ||
                                    'Worker',
                                profession:
                                    worker.profession ||
                                    ''
                            });
                        }
                    });

                    const existingLeader =
                        data.workers.find(function (worker) {
                            return worker.is_leader === true;
                        });

                    selectedLeaderWorkerId =
                        existingLeader
                            ? Number(
                                existingLeader.worker_id ||
                                existingLeader.id
                            )
                            : null;

                    renderSelectedWorkers();
                }

                setSubmitting(
                    false,
                    'Update Package'
                );
            })
            .catch(function (error) {
                console.error(
                    'Package load error:',
                    error
                );

                showFormError(
                    error && error.message
                        ? error.message
                        : 'Failed to load package.'
                );

                setSubmitting(
                    false,
                    'Update Package'
                );
            });
    }

    /* =====================================================
       EVENTS
       ===================================================== */

    function setupEvents() {
        const form =
            document.getElementById('createForm');

        if (form) {
            form.addEventListener(
                'submit',
                handleSubmit
            );
        }

        const cancelButton =
            document.getElementById('cancelBtn');

        if (cancelButton) {
            cancelButton.addEventListener(
                'click',
                redirectToPackagePage
            );
        }

        /*
         * MULTITASKING SERVICE EVENTS
         */

        const addServiceButton =
            document.getElementById('addServiceBtn');

        if (addServiceButton) {
            addServiceButton.addEventListener(
                'click',
                addService
            );
        }

        const selectedServices =
            document.getElementById('selectedServices');

        if (selectedServices) {
            selectedServices.addEventListener(
                'click',
                function (event) {
                    const button =
                        event.target.closest(
                            '.service-tag-remove'
                        );

                    if (!button) return;

                    const serviceId =
                        Number(
                            button.getAttribute(
                                'data-id'
                            )
                        );

                    if (serviceId) {
                        removeService(serviceId);
                    }
                }
            );
        }

        /*
         * TEAM WORKER SEARCH
         */

        const searchInput =
            document.getElementById(
                'workerSearchInput'
            );

        if (searchInput) {
            searchInput.addEventListener(
                'input',
                renderWorkerDropdown
            );

            searchInput.addEventListener(
                'focus',
                function () {
                    /*
                     * Do NOT display every worker
                     * just because field was focused.
                     */
                    if (
                        searchInput.value.trim()
                    ) {
                        renderWorkerDropdown();
                    }
                }
            );

            searchInput.addEventListener(
                'keydown',
                function (event) {
                    if (event.key === 'Escape') {
                        closeDropdown();
                        searchInput.blur();
                    }
                }
            );
        }

        const trigger =
            document.getElementById(
                'workerSelectTrigger'
            );

        if (trigger && searchInput) {
            trigger.addEventListener(
                'click',
                function () {
                    searchInput.focus();
                }
            );
        }

        const dropdownList =
            document.getElementById(
                'workerDropdownList'
            );

        if (dropdownList) {
            dropdownList.addEventListener(
                'click',
                function (event) {
                    const option =
                        event.target.closest(
                            '.worker-option'
                        );

                    if (!option) return;

                    const workerId =
                        Number(
                            option.getAttribute(
                                'data-worker-id'
                            )
                        );

                    if (workerId) {
                        selectWorker(workerId);
                    }
                }
            );
        }

        const selectedChips =
            document.getElementById(
                'workerSelectedChips'
            );

        if (selectedChips) {
            selectedChips.addEventListener(
                'click',
                function (event) {
                    const removeButton =
                        event.target.closest(
                            '.worker-chip-remove'
                        );

                    if (removeButton) {
                        const workerId =
                            Number(
                                removeButton.getAttribute(
                                    'data-worker-id'
                                )
                            );

                        if (workerId) {
                            removeWorker(workerId);
                        }

                        return;
                    }

                    const leaderButton =
                        event.target.closest(
                            '.worker-chip-leader'
                        );

                    if (leaderButton) {
                        const workerId =
                            Number(
                                leaderButton.getAttribute(
                                    'data-worker-id'
                                )
                            );

                        if (!workerId) return;

                        if (
                            selectedLeaderWorkerId !== null &&
                            Number(selectedLeaderWorkerId) ===
                                workerId
                        ) {
                            selectedLeaderWorkerId = null;
                        } else {
                            selectedLeaderWorkerId = workerId;
                        }

                        showFieldError('teamError', '');

                        renderSelectedWorkers();
                    }
                }
            );
        }

        /*
         * Close autocomplete when
         * clicking outside.
         */

        document.addEventListener(
            'click',
            function (event) {
                const multiSelect =
                    document.getElementById(
                        'workerMultiSelect'
                    );

                if (
                    dropdownOpen &&
                    multiSelect &&
                    !multiSelect.contains(event.target)
                ) {
                    closeDropdown();
                }
            }
        );
    }

    /* =====================================================
       INITIALIZATION
       ===================================================== */

    function init() {
        if (!api.requireRole('worker')) {
            return;
        }

        const params = getQueryParams();

        packageType =
            params.type === 'team'
                ? 'team'
                : 'multitasking';

        const packageId =
            params.package_id
                ? Number(params.package_id)
                : null;

        isEditMode =
            Number.isInteger(packageId) &&
            packageId > 0;

        configurePackageType();
        setupEvents();

        const backButton =
            document.getElementById('backBtn');

        if (backButton) {
            backButton.href =
                packageType === 'team'
                    ? 'provider-team-package.html'
                    : 'provider-multitasking-package.html';
        }

        if (isEditMode) {
            const packageIdInput =
                document.getElementById(
                    'packageId'
                );

            if (packageIdInput) {
                packageIdInput.value =
                    String(packageId);
            }

            const statusField =
                document.getElementById(
                    'statusFieldGroup'
                );

            if (statusField) {
                statusField.hidden = false;
            }
        }

        /*
         * TEAM PACKAGE:
         * Load registered workers only.
         */

        if (packageType === 'team') {
            loadWorkers()
                .then(function (data) {
                    if (!data) return;

                    prepareWorkers(data);
                    renderSelectedWorkers();

                    if (isEditMode) {
                        return loadPackage(packageId);
                    }

                    setSubmitting(
                        false,
                        'Save Package'
                    );
                })
                .catch(function (error) {
                    console.error(
                        'Worker loading error:',
                        error
                    );

                    const list =
                        document.getElementById(
                            'workerDropdownList'
                        );

                    if (list) {
                        list.innerHTML =
                            '<div class="autocomplete-empty">' +
                                'Unable to load workers.' +
                            '</div>';
                    }

                    showFormError(
                        'Unable to load workers. Please refresh the page.'
                    );

                    setSubmitting(
                        false,
                        'Save Package'
                    );
                });

            return;
        }

        /*
         * MULTITASKING PACKAGE:
         * Load services only.
         */

        loadServices()
            .then(function (data) {
                if (!data) return;

                services = data || [];

                populateServiceSelect();

                if (isEditMode) {
                    return loadPackage(packageId);
                }

                setSubmitting(
                    false,
                    'Save Package'
                );
            })
            .catch(function (error) {
                console.error(
                    'Service loading error:',
                    error
                );

                showFormError(
                    'Unable to load services. Please refresh the page.'
                );

                setSubmitting(
                    false,
                    'Save Package'
                );
            });
    }

    /* =====================================================
       START
       ===================================================== */

    if (document.readyState === 'loading') {
        document.addEventListener(
            'DOMContentLoaded',
            init
        );
    } else {
        init();
    }

})();