/* =========================================================
   HandyHire - Quick Hire JavaScript
   Shared instant-booking flow for both customer and worker roles.
   Phase 2: Real available-professional matching + Details shell.
   ========================================================= */

(function () {
    'use strict';

    // ---------- State ----------
    let currentRole = null;
    let currentUserId = null;
    let selectedService = null;
    let allServices = [];
    let selectedProfessional = null;
    let immediateWorkers = [];
    let workerResults = [];
    let selectedBeforePhotos = [];
    let quickHireAddress = '';
    let quickHireHours = 1;
    let quickHireDescription = '';

    const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
    const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

    // ---------- Role detection ----------
    function detectRole() {
        try {
            if (window.HandyHireAPI && typeof window.HandyHireAPI.getCurrentUser === 'function') {
                const user = window.HandyHireAPI.getCurrentUser();
                if (user && (user.role === 'customer' || user.role === 'worker')) {
                    currentUserId = user.id != null ? String(user.id) : null;
                    return user.role;
                }
            }
        } catch (e) {
            // Ignore detection errors.
        }
        currentUserId = null;
        return null;
    }

    function getHomeHref() {
        return currentRole === 'worker' ? 'provider-home.html' : 'home.html';
    }

    // ---------- DOM refs ----------
    function get(id) {
        return document.getElementById(id);
    }

    // ---------- Services ----------
    async function loadServices() {
        const grid = get('quickHireServiceGrid');
        const loading = get('serviceLoading');
        if (loading) loading.hidden = false;

        if (!(window.HandyHireAPI && typeof window.HandyHireAPI.apiFetch === 'function')) {
            if (grid) grid.innerHTML = '<p class="quickhire-empty">Unable to load services right now.</p>';
            return;
        }

        try {
            const resp = await window.HandyHireAPI.apiFetch('/api/services');
            if (!resp.ok) throw new Error('services-failed');
            const data = await resp.json();
            allServices = Array.isArray(data) ? data : [];
        } catch (e) {
            allServices = [];
        }

        renderServiceGrid();
    }

    function renderServiceGrid() {
        const grid = get('quickHireServiceGrid');
        if (!grid) return;

        if (!allServices.length) {
            grid.innerHTML = '<p class="quickhire-empty">No services available right now.</p>';
            return;
        }

        grid.innerHTML = allServices.map(function (svc) {
            const name = escapeHtml(svc.name || '');
            const category = escapeHtml(svc.category || '');
            const desc = escapeHtml(svc.description || '');
            return (
                '<button type="button" class="quickhire-service-card" data-service-id="' + svc.id + '" role="listitem">' +
                    '<span class="quickhire-service-name">' + name + '</span>' +
                    (category ? '<span class="quickhire-service-category">' + category + '</span>' : '') +
                    (desc ? '<span class="quickhire-service-desc">' + desc + '</span>' : '') +
                '</button>'
            );
        }).join('');

        grid.querySelectorAll('.quickhire-service-card').forEach(function (card) {
            card.addEventListener('click', function () {
                selectService(card);
            });
        });
    }

    function selectService(card) {
        document.querySelectorAll('.quickhire-service-card').forEach(function (c) {
            c.classList.remove('is-selected');
            c.setAttribute('aria-pressed', 'false');
        });
        card.classList.add('is-selected');
        card.setAttribute('aria-pressed', 'true');

        const id = card.getAttribute('data-service-id');
        const svc = allServices.find(function (s) { return String(s.id) === String(id); });
        selectedService = svc || null;

        const continueBtn = get('serviceContinue');
        if (continueBtn) continueBtn.disabled = false;
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ---------- Immediate availability ----------
    function isImmediateAvailability(raw) {
        const value = String(raw || '').trim().toLowerCase();
        return value === 'on-spot' || value === 'both';
    }

    function isValidPrice(worker) {
        const price = Number(worker.price);
        return Number.isFinite(price) && price > 0;
    }

    function getWorkerPrice(worker) {
        const price = Number(worker.price);
        return Number.isFinite(price) && price > 0 ? price : Number.POSITIVE_INFINITY;
    }

    function formatWorkerPrice(worker) {
        const price = Number(worker.price);
        if (!Number.isFinite(price) || price <= 0) return 'Price unavailable';
        return '\u20B9' + price + ' / hr';
    }

    // ---------- Service relevance ----------
    function serviceRelevance(worker) {
        if (!selectedService) return 0;

        const serviceTokens = new Set();
        const serviceText = [
            selectedService.name,
            selectedService.category,
            selectedService.description,
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .split(/[\s,-]+/);

        serviceText.forEach(function (token) {
            if (token.length > 1) serviceTokens.add(token);
        });

        const profession = String(worker.profession || '').toLowerCase();
        let score = 0;

        serviceTokens.forEach(function (token) {
            if (profession.indexOf(token) !== -1) {
                score += 2;
            }
        });

        if (selectedService.name && profession.indexOf(String(selectedService.name).toLowerCase()) !== -1) {
            score += 3;
        }

        if (selectedService.category && profession.indexOf(String(selectedService.category).toLowerCase()) !== -1) {
            score += 2;
        }

        return score;
    }

    // ---------- Workers ----------
    async function loadWorkers() {
        const area = get('professionalsArea');
        const loading = get('professionalsLoading');
        const grid = get('workerGrid');
        const empty = get('workerEmpty');
        const emptySub = get('workerEmptySub');
        const emptyActions = get('workerEmptyActions');
        const errorEl = get('workerError');
        const errorActions = get('workerErrorActions');

        if (loading) loading.hidden = false;
        if (grid) grid.innerHTML = '';
        if (empty) empty.hidden = true;
        if (emptySub) emptySub.hidden = true;
        if (emptyActions) emptyActions.hidden = true;
        if (errorEl) errorEl.hidden = true;
        if (errorActions) errorActions.hidden = true;

        if (!(window.HandyHireAPI && typeof window.HandyHireAPI.apiFetch === 'function')) {
            showWorkerError();
            return;
        }

        try {
            const resp = await window.HandyHireAPI.apiFetch('/api/workers');
            if (!resp.ok) throw new Error('workers-failed');
            const data = await resp.json();
            let workers = Array.isArray(data) ? data : [];

            immediateWorkers = workers.filter(function (w) {
                return isImmediateAvailability(w.availability);
            });

            if (currentUserId) {
                immediateWorkers = immediateWorkers.filter(function (w) {
                    return String(w.id) !== currentUserId;
                });
            }

            workerResults = immediateWorkers.slice().sort(function (a, b) {
                const relevanceDiff = serviceRelevance(b) - serviceRelevance(a);
                if (relevanceDiff !== 0) return relevanceDiff;

                const ratingA = Number(a.average_rating) || 0;
                const ratingB = Number(b.average_rating) || 0;
                if (ratingB !== ratingA) return ratingB - ratingA;

                const priceA = getWorkerPrice(a);
                const priceB = getWorkerPrice(b);
                return priceA - priceB;
            });

            renderWorkers();
        } catch (e) {
            showWorkerError();
        }
    }

    function showWorkerError() {
        const loading = get('professionalsLoading');
        const errorEl = get('workerError');
        const errorActions = get('workerErrorActions');
        if (loading) loading.hidden = true;
        if (errorEl) errorEl.hidden = false;
        if (errorActions) errorActions.hidden = false;
    }

    function renderWorkers() {
        const grid = get('workerGrid');
        const loading = get('professionalsLoading');
        const empty = get('workerEmpty');
        const emptySub = get('workerEmptySub');
        const emptyActions = get('workerEmptyActions');

        if (loading) loading.hidden = true;

        if (!grid) return;

        if (!workerResults.length) {
            grid.innerHTML = '';
            if (empty) empty.hidden = false;
            if (emptySub) emptySub.hidden = false;
            if (emptyActions) emptyActions.hidden = false;
            return;
        }

        if (empty) empty.hidden = true;
        if (emptySub) emptySub.hidden = true;
        if (emptyActions) emptyActions.hidden = true;

        grid.innerHTML = workerResults.map(function (worker) {
            const name = escapeHtml(worker.full_name || worker.name || 'Professional');
            const profession = escapeHtml(worker.profession || '');
            const location = escapeHtml(worker.location || '');
            const price = formatWorkerPrice(worker);
            const rating = Number(worker.average_rating) || 0;
            const reviewCount = Number(worker.review_count) || 0;
            const reviewText = reviewCount === 1 ? '1 review' : reviewCount + ' reviews';
            const avatar = worker.profile_image
                ? 'url("' + worker.profile_image + '")'
                : buildAvatarDataUrl(name);
            const isSelected = selectedProfessional && String(selectedProfessional.id) === String(worker.id);

            return (
                '<article class="quickhire-worker-card" tabindex="0" data-worker-id="' + worker.id + '" role="listitem" aria-pressed="' + (isSelected ? 'true' : 'false') + '">' +
                    '<div class="quickhire-worker-avatar" style="background-image: ' + avatar + '" aria-hidden="true"></div>' +
                    '<div class="quickhire-worker-info">' +
                        '<h3 class="quickhire-worker-name">' + name + '</h3>' +
                        '<p class="quickhire-worker-profession">' + profession + '</p>' +
                        (location ? '<p class="quickhire-worker-location">' + location + '</p>' : '') +
                        '<div class="quickhire-worker-meta">' +
                            '<span class="quickhire-worker-rating">' +
                                '<span class="quickhire-star" aria-hidden="true">&#9733;</span> ' +
                                '<span>' + rating.toFixed(1) + '</span>' +
                            '</span>' +
                            '<span class="quickhire-worker-reviews">' + reviewText + '</span>' +
                        '</div>' +
                        '<div class="quickhire-worker-footer">' +
                            '<span class="quickhire-worker-price">' + price + '</span>' +
                            '<span class="quickhire-availability-badge">Available now</span>' +
                        '</div>' +
                    '</div>' +
                    '<button type="button" class="quickhire-select-worker" data-worker-id="' + worker.id + '">' +
                        (isSelected ? 'Selected' : 'Select') +
                    '</button>' +
                '</article>'
            );
        }).join('');

        grid.querySelectorAll('.quickhire-worker-card').forEach(function (card) {
            const selectBtn = card.querySelector('.quickhire-select-worker');
            if (selectBtn) {
                selectBtn.addEventListener('click', function (event) {
                    event.stopPropagation();
                    selectWorker(card);
                });
            }

            card.addEventListener('click', function () {
                selectWorker(card);
            });

            card.addEventListener('keydown', function (event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    selectWorker(card);
                }
            });
        });
    }

    function selectWorker(card) {
        const workerId = card.getAttribute('data-worker-id');
        const worker = workerResults.find(function (w) { return String(w.id) === String(workerId); });
        selectedProfessional = worker || null;

        document.querySelectorAll('.quickhire-worker-card').forEach(function (c) {
            c.classList.remove('is-selected');
            c.setAttribute('aria-pressed', 'false');
            const btn = c.querySelector('.quickhire-select-worker');
            if (btn) btn.textContent = 'Select';
        });

        if (worker) {
            card.classList.add('is-selected');
            card.setAttribute('aria-pressed', 'true');
            const btn = card.querySelector('.quickhire-select-worker');
            if (btn) btn.textContent = 'Selected';
        }

        const continueBtn = get('professionalsContinue');
        if (continueBtn) continueBtn.disabled = !selectedProfessional;
    }

    function buildAvatarDataUrl(name) {
        const initials = name
            .split(' ')
            .filter(Boolean)
            .map(function (part) { return part.charAt(0).toUpperCase(); })
            .slice(0, 2)
            .join('') || '?';

        const hue = Array.from(name).reduce(function (sum, ch) { return sum + ch.charCodeAt(0); }, 0) % 360;

        const svg = [
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">',
            '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">',
            '<stop offset="0%" stop-color="hsl(' + hue + ', 35%, 70%)"/>',
            '<stop offset="100%" stop-color="hsl(' + (hue + 40) % 360 + ', 40%, 55%)"/>',
            '</linearGradient></defs>',
            '<circle cx="60" cy="60" r="60" fill="url(#g)"/>',
            '<text x="50%" y="54%" text-anchor="middle" font-family="Inter, sans-serif" font-size="44" font-weight="700" fill="#ffffff" dominant-baseline="middle">',
            escapeHtml(initials),
            '</text>',
            '</svg>',
        ].join('');

        return 'url("data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '")';
    }

    // ---------- Progress ----------
    function setActiveStep(step) {
        document.querySelectorAll('.quickhire-progress-step').forEach(function (el) {
            const s = Number(el.getAttribute('data-step'));
            el.classList.toggle('is-active', s === step);
            el.classList.toggle('is-completed', s < step);
        });
    }

    function showStep(step) {
        setActiveStep(step);
        const stepIds = ['stepService', 'stepProfessionals', 'stepDetails', 'stepConfirm'];
        stepIds.forEach(function (id) {
            const el = get(id);
            if (!el) return;
            const stepMap = { stepService: 1, stepProfessionals: 2, stepDetails: 3, stepConfirm: 4 };
            const isCurrent = stepMap[id] === step;
            if (isCurrent) {
                el.hidden = false;
                el.classList.remove('is-hidden');
            } else {
                el.hidden = true;
                el.classList.add('is-hidden');
            }
        });
    }

    function getCurrentStep() {
        const stepIds = ['stepService', 'stepProfessionals', 'stepDetails', 'stepConfirm'];
        for (let i = 0; i < stepIds.length; i++) {
            const el = get(stepIds[i]);
            if (el && !el.hidden) {
                return i + 1;
            }
        }
        return 1;
    }

    // ---------- Service summary ----------
    function updateServiceSummary() {
        const nameEl = get('selectedServiceName');
        if (nameEl) {
            nameEl.textContent = selectedService ? selectedService.name : '';
        }
    }

    // ---------- Photos ----------
    function initPhotoUpload() {
        const input = get('quickHireBeforePhotoInput');
        if (!input) return;

        input.addEventListener('change', function () {
            const files = input.files;
            if (!files || !files.length) return;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
                    showPhotoError('Only JPG, PNG, and WEBP images are allowed.');
                    continue;
                }
                if (file.size > MAX_PHOTO_BYTES) {
                    showPhotoError('Each photo must be 5 MB or smaller.');
                    continue;
                }
                selectedBeforePhotos.push(file);
            }

            renderPhotoPreviews();
            input.value = '';
        });
    }

    function renderPhotoPreviews() {
        const grid = get('quickHireBeforePhotoPreview');
        if (!grid) return;

        if (!selectedBeforePhotos.length) {
            grid.hidden = true;
            const existingImages = grid.querySelectorAll('img');
            existingImages.forEach(function (img) {
                if (img.src) {
                    URL.revokeObjectURL(img.src);
                }
            });
            grid.innerHTML = '';
            return;
        }

        grid.hidden = false;
        const existingImages = grid.querySelectorAll('img');
        existingImages.forEach(function (img) {
            if (img.src) {
                URL.revokeObjectURL(img.src);
            }
        });

        grid.innerHTML = selectedBeforePhotos.map(function (file, index) {
            const url = URL.createObjectURL(file);
            return (
                '<div class="quickhire-photo-preview-item" data-photo-index="' + index + '">' +
                    '<img src="' + url + '" alt="Before job photo preview" />' +
                    '<button type="button" class="quickhire-photo-remove" data-remove-index="' + index + '" aria-label="Remove photo">&times;</button>' +
                '</div>'
            );
        }).join('');

        grid.querySelectorAll('.quickhire-photo-remove').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const index = parseInt(btn.getAttribute('data-remove-index'), 10);
                if (Number.isFinite(index) && index >= 0 && index < selectedBeforePhotos.length) {
                    const item = grid.querySelector('[data-photo-index="' + index + '"]');
                    if (item) {
                        const img = item.querySelector('img');
                        if (img && img.src) {
                            URL.revokeObjectURL(img.src);
                        }
                    }
                    selectedBeforePhotos.splice(index, 1);
                    renderPhotoPreviews();
                }
            });
        });
    }

    function showPhotoError(message) {
        const el = get('quickHirePhotoError');
        if (!el) return;
        el.textContent = message;
        el.hidden = false;
    }

    function clearPhotoError() {
        const el = get('quickHirePhotoError');
        if (el) {
            el.hidden = true;
            el.textContent = '';
        }
    }

    let step3Initialized = false;
let quickHireSubmitting = false;
let createdBookingId = null;

    // ---------- Helpers ----------
    function getNextAsapSlot() {
        const now = new Date();
        const minutes = now.getMinutes();
        const target = new Date(now);
        if (minutes < 30) {
            target.setMinutes(30, 0, 0);
        } else {
            target.setHours(now.getHours() + 1, 0, 0, 0);
        }
        const yyyy = target.getFullYear();
        const mm = String(target.getMonth() + 1).padStart(2, '0');
        const dd = String(target.getDate()).padStart(2, '0');
        const hh = String(target.getHours()).padStart(2, '0');
        const min = String(target.getMinutes()).padStart(2, '0');
        return {
            booking_date: yyyy + '-' + mm + '-' + dd,
            booking_time: hh + ':' + min,
            display: hh + ':' + min,
        };
    }

    function setConfirmMessage(message, hidden) {
        const el = get('quickHireConfirmMessage');
        if (!el) return;
        el.textContent = message || '';
        el.hidden = hidden !== false ? true : false;
    }

    function redirectByRole(bookingId) {
        if (currentRole === 'worker') {
            window.location.href = 'provider-booking-success.html?booking_id=' + encodeURIComponent(String(bookingId));
        } else {
            window.location.href = 'booking-success.html?booking_id=' + encodeURIComponent(String(bookingId));
        }
    }

    function formatAsapDisplay() {
        const slot = getNextAsapSlot();
        const parts = slot.display.split(':');
        const hour = Number(parts[0]);
        const minute = parts[1];
        const suffix = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return 'Estimated start: ' + displayHour + ':' + minute + ' ' + suffix;
    }

    // ---------- Details ----------
    function renderSelectedProfessionalSummary() {
        const container = get('selectedProfessionalSummary');
        if (!container || !selectedProfessional) return;

        const name = escapeHtml(selectedProfessional.full_name || selectedProfessional.name || 'Professional');
        const profession = escapeHtml(selectedProfessional.profession || '');
        const location = escapeHtml(selectedProfessional.location || '');
        const price = formatWorkerPrice(selectedProfessional);
        const rating = Number(selectedProfessional.average_rating) || 0;
        const reviewCount = Number(selectedProfessional.review_count) || 0;
        const reviewText = reviewCount === 1 ? '1 review' : reviewCount + ' reviews';
        const avatar = selectedProfessional.profile_image
            ? 'url("' + selectedProfessional.profile_image + '")'
            : buildAvatarDataUrl(name);

        container.innerHTML =
            '<div class="quickhire-selected-card">' +
                '<div class="quickhire-selected-avatar" style="background-image: ' + avatar + '" aria-hidden="true"></div>' +
                '<div class="quickhire-selected-info">' +
                    '<p class="quickhire-selected-name">' + name + '</p>' +
                    (profession ? '<p class="quickhire-selected-profession">' + profession + '</p>' : '') +
                    (location ? '<p class="quickhire-selected-location">' + location + '</p>' : '') +
                    '<div class="quickhire-selected-meta">' +
                        '<span class="quickhire-selected-rating">' +
                            '<span class="quickhire-star" aria-hidden="true">&#9733;</span> ' +
                            '<span>' + rating.toFixed(1) + '</span>' +
                        '</span>' +
                        '<span class="quickhire-selected-reviews">' + reviewText + '</span>' +
                        '<span class="quickhire-selected-price">' + price + '</span>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<button type="button" class="quickhire-change-professional" id="changeProfessionalBtn">Change professional</button>';
    }

    function renderStep3ServiceSummary() {
        const nameEl = get('step3SelectedServiceName');
        if (!nameEl) return;
        nameEl.textContent = selectedService ? selectedService.name : '';
    }

    function initStep3() {
        if (step3Initialized) {
            renderSelectedProfessionalSummary();
            renderStep3ServiceSummary();
            updateLivePrice();
            updateDetailsValidation();
            return;
        }

        renderSelectedProfessionalSummary();
        renderStep3ServiceSummary();
        const addressInput = get('quickHireAddress');
        const hoursSelect = get('quickHireHours');
        const descriptionInput = get('quickHireDescription');
        const continueBtn = get('detailsContinue');

        if (addressInput && !addressInput.value) {
            try {
                const currentUser = window.HandyHireAPI.getCurrentUser();
                if (currentUser && currentUser.address) {
                    addressInput.value = currentUser.address;
                    quickHireAddress = currentUser.address;
                }
            } catch (e) {
                // Ignore prefill errors.
            }
        }

        if (addressInput) {
            addressInput.addEventListener('input', function () {
                quickHireAddress = addressInput.value.trim();
                updateDetailsValidation();
            });
        }

        if (hoursSelect) {
            hoursSelect.addEventListener('change', function () {
                quickHireHours = Math.max(1, Number(hoursSelect.value) || 1);
                updateLivePrice();
                updateDetailsValidation();
            });
        }

        if (descriptionInput) {
            descriptionInput.addEventListener('input', function () {
                const value = descriptionInput.value.trim();
                quickHireDescription = value;
            });
        }

        initPhotoUpload();

        if (continueBtn) {
            continueBtn.addEventListener('click', function () {
                if (!validateStep3()) return;
                renderConfirmation();
                showStep(4);
            });
        }

        step3Initialized = true;
    }

    function validateStep3() {
        clearPhotoError();

        const address = get('quickHireAddress');
        const hours = get('quickHireHours');

        if (!selectedService) {
            return false;
        }

        if (!address || !address.value.trim()) {
            address.reportValidity();
            return false;
        }

        if (!hours || !hours.value) {
            hours.reportValidity();
            return false;
        }

        if (!selectedProfessional || !isValidPrice(selectedProfessional)) {
            return false;
        }

        return true;
    }

    function updateDetailsValidation() {
        const continueBtn = get('detailsContinue');
        if (!continueBtn) return;

        const address = get('quickHireAddress');
        const hours = get('quickHireHours');

        const addressOk = address && address.value.trim().length > 0;
        const hoursOk = hours && hours.value;
        const workerOk = !!selectedProfessional;

        continueBtn.disabled = !(addressOk && hoursOk && workerOk && isValidPrice(selectedProfessional));
    }

    function updateLivePrice() {
        const priceEl = get('quickHirePriceSummary');
        if (!priceEl || !selectedProfessional) return;

        const price = getWorkerPrice(selectedProfessional);
        const hours = quickHireHours;

        if (price === Number.POSITIVE_INFINITY) {
            priceEl.innerHTML = '<span class="quickhire-price-unavailable">Price unavailable</span>';
            return;
        }

        const total = price * hours;
        priceEl.innerHTML =
            '<span class="quickhire-price-rate">\u20B9' + price + ' / hour</span>' +
            '<span class="quickhire-price-hours">' + hours + ' hour' + (hours === 1 ? '' : 's') + '</span>' +
            '<span class="quickhire-price-total">Estimated total \u20B9' + total + '</span>';
    }

    // ---------- Confirmation ----------
    function renderConfirmation() {
        const card = get('confirmProfessionalCard');
        if (!card || !selectedProfessional) return;

        const name = escapeHtml(selectedProfessional.full_name || selectedProfessional.name || 'Professional');
        const profession = escapeHtml(selectedProfessional.profession || '');
        const location = escapeHtml(selectedProfessional.location || '');
        const price = formatWorkerPrice(selectedProfessional);
        const rating = Number(selectedProfessional.average_rating) || 0;
        const reviewCount = Number(selectedProfessional.review_count) || 0;
        const reviewText = reviewCount === 1 ? '1 review' : reviewCount + ' reviews';
        const avatar = selectedProfessional.profile_image
            ? 'url("' + selectedProfessional.profile_image + '")'
            : buildAvatarDataUrl(name);

        card.innerHTML =
            '<div class="quickhire-confirm-card">' +
                '<div class="quickhire-confirm-avatar" style="background-image: ' + avatar + '" aria-hidden="true"></div>' +
                '<div class="quickhire-confirm-info">' +
                    '<h3 class="quickhire-confirm-name">' + name + '</h3>' +
                    '<p class="quickhire-confirm-profession">' + profession + '</p>' +
                    (location ? '<p class="quickhire-confirm-location">' + location + '</p>' : '') +
                    '<div class="quickhire-confirm-meta">' +
                        '<span class="quickhire-confirm-rating">' +
                            '<span class="quickhire-star" aria-hidden="true">&#9733;</span> ' +
                            '<span>' + rating.toFixed(1) + '</span>' +
                        '</span>' +
                        '<span class="quickhire-confirm-reviews">' + reviewText + '</span>' +
                        '<span class="quickhire-confirm-price">' + price + '</span>' +
                    '</div>' +
                '</div>' +
            '</div>';

        const serviceEl = get('confirmService');
        if (serviceEl) {
            serviceEl.textContent = selectedService ? selectedService.name : '';
        }

        const whenEl = get('confirmWhen');
        if (whenEl) {
            whenEl.innerHTML = '<span class="quickhire-confirm-badge" aria-hidden="true">&#9889;</span> ASAP &mdash; As soon as possible';
        }

        const availabilityEl = get('confirmAvailability');
        if (availabilityEl) {
            availabilityEl.innerHTML = '<span class="quickhire-availability-badge">Available now</span>';
        }

        const addressEl = get('confirmAddress');
        if (addressEl) {
            addressEl.textContent = quickHireAddress || '';
        }

        const durationEl = get('confirmDuration');
        if (durationEl) {
            durationEl.textContent = quickHireHours + ' hour' + (quickHireHours === 1 ? '' : 's');
        }

        const detailsEl = get('confirmDetails');
        if (detailsEl) {
            detailsEl.textContent = quickHireDescription.trim() || 'No additional details';
        }

        const photosEl = get('confirmPhotos');
        if (photosEl) {
            photosEl.textContent = selectedBeforePhotos.length + ' photo' + (selectedBeforePhotos.length === 1 ? '' : 's') + ' attached';
        }

        const priceSummaryEl = get('confirmPriceSummary');
        if (priceSummaryEl && selectedProfessional && isValidPrice(selectedProfessional)) {
            const price = getWorkerPrice(selectedProfessional);
            const total = price * quickHireHours;
            priceSummaryEl.innerHTML =
                '<span>\u20B9' + price + ' / hour</span>' +
                '<span>Estimated total \u20B9' + total + '</span>';
        }
    }



    function setConfirmMessage(message, hidden) {
        const el = get('quickHireConfirmMessage');
        if (!el) return;
        el.textContent = message || '';
        el.hidden = hidden !== false ? true : false;
    }

    function redirectByRole(bookingId) {
        if (currentRole === 'worker') {
            window.location.href = 'provider-booking-success.html?booking_id=' + encodeURIComponent(String(bookingId));
        } else {
            window.location.href = 'booking-success.html?booking_id=' + encodeURIComponent(String(bookingId));
        }
    }

    function formatAsapDisplay() {
        const slot = getNextAsapSlot();
        const parts = slot.display.split(':');
        const hour = Number(parts[0]);
        const minute = parts[1];
        const suffix = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return 'Estimated start: ' + displayHour + ':' + minute + ' ' + suffix;
    }

    async function uploadBeforePhotos(bookingId) {
        if (!selectedBeforePhotos.length) {
            return Promise.resolve([]);
        }

        const uploads = selectedBeforePhotos.map(function (file) {
            const formData = new FormData();
            formData.append('photo_type', 'before');
            formData.append('file', file, file.name);
            return window.HandyHireAPI.apiFetch('/api/bookings/' + encodeURIComponent(String(bookingId)) + '/photos', {
                method: 'POST',
                body: formData,
            }).then(function (response) {
                if (!response.ok) {
                    throw new Error('upload-failed');
                }
                return response.json();
            });
        });

        return Promise.allSettled(uploads);
    }

  async function submitQuickHireBooking() {
    if (createdBookingId) {
        redirectByRole(createdBookingId);
        return;
    }

    if (quickHireSubmitting) return;
        if (!selectedService || !selectedProfessional) {
            setConfirmMessage('Please select a service and a professional.', false);
            return;
        }

        const confirmBtn = get('confirmQuickHireBtn');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Confirming Quick Hire...';
        }
        quickHireSubmitting = true;
        setConfirmMessage('', true);

        try {
            if (!(window.HandyHireAPI && typeof window.HandyHireAPI.apiFetch === 'function')) {
                throw new Error('api-unavailable');
            }

            if (currentUserId && String(selectedProfessional.id) === String(currentUserId)) {
                throw new Error('self-booking');
            }

            const freshResp = await window.HandyHireAPI.apiFetch('/api/workers/' + encodeURIComponent(String(selectedProfessional.id)));
            if (!freshResp.ok) {
                throw new Error('worker-unavailable');
            }
            const freshWorker = await freshResp.json();

            if (!isImmediateAvailability(freshWorker.availability)) {
                throw new Error('worker-unavailable');
            }

            const hourlyRate = Number(freshWorker.price);
            if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
                throw new Error('price-unavailable');
            }

            const previousPrice = getWorkerPrice(selectedProfessional);
            selectedProfessional = freshWorker;
            if (previousPrice !== hourlyRate) {
                updateLivePrice();
                renderConfirmation();
                setConfirmMessage('The professional\'s rate has changed. Please review the updated price before confirming.', false);
                if (confirmBtn) {
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = '\u2605 Confirm Quick Hire';
                }
                quickHireSubmitting = false;
                return;
            }

            const slot = getNextAsapSlot();
            const payload = {
                worker_id: Number(freshWorker.id),
                service_id: selectedService.id != null ? Number(selectedService.id) : null,
                booking_date: slot.booking_date,
                booking_time: slot.booking_time,
                address: quickHireAddress.trim(),
                description: quickHireDescription.trim() || null,
                amount: hourlyRate * quickHireHours,
                hours: quickHireHours,
            };

            const bookingResp = await window.HandyHireAPI.apiFetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (bookingResp.status === 409) {
                throw new Error('slot-conflict');
            }

            if (!bookingResp.ok) {
                let detail = 'booking-failed';
                try {
                    const data = await bookingResp.json();
                    if (data && data.detail) detail = String(data.detail);
                } catch (e) {
                    // ignore parse errors
                }
                throw new Error(detail);
            }

            const booking = await bookingResp.json();
            const bookingId = booking && booking.id ? booking.id : null;
            if (!bookingId) {
                throw new Error('booking-id-missing');
            }
            createdBookingId = bookingId;

            if (!selectedBeforePhotos.length) {
                redirectByRole(bookingId);
                return;
            }

            const uploadResults = await uploadBeforePhotos(bookingId);
            const failedUploads = uploadResults.filter(function (result) { return result.status === 'rejected'; }).length;
            if (failedUploads > 0) {
                setConfirmMessage('Your Quick Hire was confirmed, but some job photos could not be uploaded. You can add them later.', false);
               if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Continue';
}
                quickHireSubmitting = false;
                return;
            }

            redirectByRole(bookingId);
        } catch (error) {
            quickHireSubmitting = false;
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.textContent = '\u2605 Confirm Quick Hire';
            }

            if (error.message === 'worker-unavailable') {
                setConfirmMessage('This professional is no longer available right now. Please choose another professional.', false);
                return;
            }

            if (error.message === 'self-booking') {
                setConfirmMessage('You cannot book yourself.', false);
                return;
            }

            if (error.message === 'price-unavailable') {
                setConfirmMessage('Current pricing is unavailable for this professional.', false);
                return;
            }

            if (error.message === 'slot-conflict') {
                setConfirmMessage('This professional was just booked for the next available slot. Please choose another professional.', false);
                return;
            }

            setConfirmMessage('We couldn\'t confirm your Quick Hire. Please try again.', false);
        }
    }

    // ---------- Confirmation ----------
    function initNavigation() {
        const back = get('quickHireBack');
        if (back) {
            back.setAttribute('href', getHomeHref());
            back.addEventListener('click', function (event) {
                const currentStep = getCurrentStep();
                if (currentStep === 4) {
                    event.preventDefault();
                    showStep(3);
                    back.setAttribute('href', 'quick-hire.html');
                } else if (currentStep === 3) {
                    event.preventDefault();
                    showStep(2);
                    back.setAttribute('href', 'quick-hire.html');
                } else if (currentStep === 2) {
                    event.preventDefault();
                    showStep(1);
                    back.setAttribute('href', getHomeHref());
                }
            });
        }

        const serviceContinue = get('serviceContinue');
        if (serviceContinue) {
            serviceContinue.addEventListener('click', function () {
                if (!selectedService) return;
                updateServiceSummary();
                showStep(2);
                if (back) back.setAttribute('href', 'quick-hire.html');
                loadWorkers();
            });
        }

        const professionalsBack = get('professionalsBack');
        if (professionalsBack) {
            professionalsBack.addEventListener('click', function () {
                showStep(1);
                if (back) back.setAttribute('href', getHomeHref());
            });
        }

        const changeServiceBtn = get('changeServiceBtn');
        if (changeServiceBtn) {
            changeServiceBtn.addEventListener('click', function () {
                selectedProfessional = null;
                const continueBtn = get('professionalsContinue');
                if (continueBtn) continueBtn.disabled = true;
                showStep(1);
                if (back) back.setAttribute('href', getHomeHref());
            });
        }

        const refreshBtn = get('refreshWorkersBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function () {
                selectedProfessional = null;
                const continueBtn = get('professionalsContinue');
                if (continueBtn) continueBtn.disabled = true;
                loadWorkers();
            });
        }

        const tryAgainBtn = get('tryAgainBtn');
        if (tryAgainBtn) {
            tryAgainBtn.addEventListener('click', function () {
                selectedProfessional = null;
                const continueBtn = get('professionalsContinue');
                if (continueBtn) continueBtn.disabled = true;
                loadWorkers();
            });
        }

        const tryAgainErrorBtn = get('tryAgainErrorBtn');
        if (tryAgainErrorBtn) {
            tryAgainErrorBtn.addEventListener('click', function () {
                selectedProfessional = null;
                const continueBtn = get('professionalsContinue');
                if (continueBtn) continueBtn.disabled = true;
                loadWorkers();
            });
        }

        const regularBookingBtn = get('regularBookingBtn');
        if (regularBookingBtn) {
            regularBookingBtn.addEventListener('click', function () {
                window.location.href = getHomeHref();
            });
        }

        const professionalsContinue = get('professionalsContinue');
        if (professionalsContinue) {
            professionalsContinue.addEventListener('click', function () {
                if (!selectedProfessional) return;
                initStep3();
                updateLivePrice();
                updateDetailsValidation();
                showStep(3);
                if (back) back.setAttribute('href', 'quick-hire.html');
            });
        }

        const changeProfessionalBtn = get('changeProfessionalBtn');
        if (changeProfessionalBtn) {
            changeProfessionalBtn.addEventListener('click', function () {
                selectedProfessional = null;
                const continueBtn = get('professionalsContinue');
                if (continueBtn) continueBtn.disabled = true;
                showStep(2);
                if (back) back.setAttribute('href', 'quick-hire.html');
            });
        }

        const step3ChangeServiceBtn = get('step3ChangeServiceBtn');
        if (step3ChangeServiceBtn) {
            step3ChangeServiceBtn.addEventListener('click', function () {
                selectedProfessional = null;
                const continueBtn = get('professionalsContinue');
                if (continueBtn) continueBtn.disabled = true;
                showStep(1);
                if (back) back.setAttribute('href', getHomeHref());
            });
        }

        const detailsBack = get('detailsBack');
        if (detailsBack) {
            detailsBack.addEventListener('click', function () {
                showStep(2);
                if (back) back.setAttribute('href', 'quick-hire.html');
            });
        }

        const editDetailsBtn = get('editDetailsBtn');
        if (editDetailsBtn) {
            editDetailsBtn.addEventListener('click', function () {
                showStep(3);
                if (back) back.setAttribute('href', 'quick-hire.html');
            });
        }

        const confirmBtn = get('confirmQuickHireBtn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', function () {
                submitQuickHireBooking();
            });
        }
    }

    // ---------- Init ----------
    function init() {
        currentRole = detectRole();
        if (!currentRole) {
            window.location.href = 'login.html';
            return;
        }

        initNavigation();
        loadServices();
        showStep(1);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
