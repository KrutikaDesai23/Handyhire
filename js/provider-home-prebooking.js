/* =========================================================
   HandyHire — Provider Pre-booking Discovery
   Shows only professionals who accept scheduled bookings.
   ========================================================= */

(function () {
    'use strict';

    var allWorkers = [];
    var currentSearch = '';
    var currentSort = '';

    function getApi() {
        return window.HandyHireAPI || null;
    }

    function requireAuth() {
        var api = getApi();

        if (!api) {
            window.location.href = 'login.html';
            return false;
        }

        if (typeof api.requireRole === 'function') {
            return api.requireRole('worker');
        }

        if (typeof api.isLoggedIn === 'function' && !api.isLoggedIn()) {
            window.location.href = 'login.html';
            return false;
        }

        return true;
    }

    function normalizeAvailability(value) {
        var normalized = String(value || '')
            .toLowerCase()
            .trim()
            .replace(/_/g, '-')
            .replace(/\s+/g, '-');

        if (normalized === 'prebooking') return 'pre-booking';
        if (normalized === 'onspot') return 'on-spot';
        return normalized;
    }

    function normalizeWorker(record) {
        var item = record || {};
        var profile = item.worker_profile || item.profile || {};
        var user = item.user || profile.user || {};

        return {
            id: item.id || item.worker_id || profile.worker_id || user.id || '',
            fullName: item.full_name || profile.full_name || user.full_name || user.name || 'Professional',
            profession: item.profession || profile.profession || item.service || 'Professional',
            location: item.location || profile.location || 'Location not specified',
            price: item.price != null ? item.price : profile.price,
            availability: item.availability || profile.availability || item.booking_type || item.service_type || '',
            rating: item.average_rating != null
                ? item.average_rating
                : (profile.average_rating != null ? profile.average_rating : item.rating),
            profileImage: item.profile_image || profile.profile_image || user.profile_image || ''
        };
    }

    function getInitials(name) {
        return String(name || 'P')
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map(function (part) { return part.charAt(0).toUpperCase(); })
            .slice(0, 2)
            .join('') || 'P';
    }

    function isPrebookable(worker) {
        var value = normalizeAvailability(worker && worker.availability);
        return value === 'pre-booking' || value === 'both';
    }

    function showState(type, title, copy) {
        var grid = document.getElementById('serviceGrid');
        if (!grid) return;

        grid.innerHTML = '';

        var state = document.createElement('div');
        state.className = type + '-state';

        var icon = document.createElement('span');
        icon.className = 'state-icon';
        icon.textContent = type === 'loading' ? '…' : (type === 'error' ? '!' : '✓');

        var heading = document.createElement('p');
        heading.className = 'state-title';
        heading.textContent = title;

        var paragraph = document.createElement('p');
        paragraph.className = 'state-copy';
        paragraph.textContent = copy;

        state.appendChild(icon);
        state.appendChild(heading);
        state.appendChild(paragraph);
        grid.appendChild(state);
    }

    function openWorker(worker) {
        if (!worker || !worker.id) return;

        try {
            sessionStorage.setItem('handyhire.selectedWorkerId', String(worker.id));
            sessionStorage.setItem('handyhire.provider.previousPage', window.location.href);
        } catch (error) {
            /* Navigation works without sessionStorage. */
        }

        window.location.href = 'provider-job-hire.html?worker_id=' + encodeURIComponent(String(worker.id));
    }

    function createWorkerCard(worker) {
        var card = document.createElement('article');
        card.className = 'worker-card';
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', 'View ' + worker.fullName + ', ' + worker.profession);
        card.dataset.workerId = String(worker.id || '');

        var avatar = document.createElement('div');
        avatar.className = 'worker-avatar';
        avatar.setAttribute('aria-hidden', 'true');

        if (worker.profileImage) {
            avatar.style.backgroundImage = 'url("' + String(worker.profileImage).replace(/"/g, '%22') + '")';
        } else {
            avatar.textContent = getInitials(worker.fullName);
        }

        var name = document.createElement('h3');
        name.className = 'worker-name';
        name.textContent = worker.fullName;

        var profession = document.createElement('p');
        profession.className = 'worker-profession';
        profession.textContent = worker.profession;

        var location = document.createElement('p');
        location.className = 'worker-location';
        location.textContent = worker.location;

        var availability = document.createElement('span');
        availability.className = 'worker-availability';
        availability.textContent = normalizeAvailability(worker.availability) === 'both'
            ? 'Pre-booking + On-spot'
            : 'Pre-booking';

        var meta = document.createElement('div');
        meta.className = 'worker-meta';

        var rating = document.createElement('span');
        rating.className = 'worker-rating';
        var ratingNumber = Number(worker.rating);
        rating.textContent = Number.isFinite(ratingNumber) && ratingNumber > 0
            ? '★ ' + ratingNumber.toFixed(1)
            : '★ New';

        var price = document.createElement('span');
        price.className = 'worker-price';
        var priceNumber = Number(worker.price);
        price.innerHTML = Number.isFinite(priceNumber) && priceNumber > 0
            ? '₹' + Math.round(priceNumber) + '<small>/ hour</small>'
            : 'Rate unavailable';

        meta.appendChild(rating);
        meta.appendChild(price);

        card.appendChild(avatar);
        card.appendChild(name);
        card.appendChild(profession);
        card.appendChild(location);
        card.appendChild(availability);
        card.appendChild(meta);

        card.addEventListener('click', function () { openWorker(worker); });
        card.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openWorker(worker);
            }
        });

        return card;
    }

    function sortWorkers(workers) {
        var list = workers.slice();

        if (currentSort === 'rating') {
            list.sort(function (a, b) { return Number(b.rating || 0) - Number(a.rating || 0); });
        } else if (currentSort === 'price_asc') {
            list.sort(function (a, b) { return Number(a.price || 0) - Number(b.price || 0); });
        } else if (currentSort === 'price_desc') {
            list.sort(function (a, b) { return Number(b.price || 0) - Number(a.price || 0); });
        } else if (currentSort === 'name') {
            list.sort(function (a, b) { return String(a.fullName).localeCompare(String(b.fullName)); });
        }

        return list;
    }

    function renderWorkers() {
        var grid = document.getElementById('serviceGrid');
        if (!grid) return;

        var query = currentSearch.trim().toLowerCase();
        var filtered = allWorkers.filter(function (worker) {
            if (!query) return true;

            return [worker.fullName, worker.profession, worker.location]
                .some(function (value) {
                    return String(value || '').toLowerCase().includes(query);
                });
        });

        filtered = sortWorkers(filtered);

        if (!filtered.length) {
            showState(
                'empty',
                currentSearch ? 'No matching professionals' : 'No pre-booking professionals yet',
                currentSearch
                    ? 'Try another name, profession or location.'
                    : 'When professionals enable scheduled bookings, they will appear here.'
            );
            return;
        }

        grid.innerHTML = '';
        filtered.forEach(function (worker) {
            grid.appendChild(createWorkerCard(worker));
        });
    }

    async function loadWorkers() {
        var api = getApi();
        showState('loading', 'Finding professionals', 'Loading professionals who accept scheduled bookings…');

        try {
            if (!api || typeof api.apiFetch !== 'function') {
                throw new Error('API helper unavailable');
            }

            var response = await api.apiFetch('/api/workers');

            if (response.status === 401) {
                if (typeof api.clearAuth === 'function') api.clearAuth();
                window.location.href = 'login.html';
                return;
            }

            if (!response.ok) {
                throw new Error('Unable to load professionals');
            }

            var data = await response.json();
            var records = Array.isArray(data)
                ? data
                : (data.workers || data.items || data.results || data.data || []);

            var currentUser = typeof api.getCurrentUser === 'function' ? api.getCurrentUser() : null;
            var currentUserId = currentUser ? (currentUser.id || currentUser.user_id) : null;

            allWorkers = (Array.isArray(records) ? records : [])
                .map(normalizeWorker)
                .filter(function (worker) {
                    if (!worker.id || !isPrebookable(worker)) return false;
                    if (!currentUserId) return true;
                    return String(worker.id) !== String(currentUserId);
                });

            renderWorkers();
        } catch (error) {
            console.error('Failed to load pre-booking professionals:', error);
            showState('error', 'Couldn’t load professionals', 'Please check your connection and try again.');
        }
    }

    function initControls() {
        var search = document.getElementById('prebookSearch');
        var sort = document.getElementById('prebookSort');

        if (search) {
            search.addEventListener('input', function () {
                currentSearch = search.value || '';
                renderWorkers();
            });
        }

        if (sort) {
            sort.addEventListener('change', function () {
                currentSort = sort.value || '';
                renderWorkers();
            });
        }
    }

    function init() {
        if (!requireAuth()) return;
        initControls();
        loadWorkers();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
