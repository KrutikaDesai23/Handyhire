/* =========================================================
   HandyHire - Customer Team Packages
   Uses the exact provider Team Package card structure and
   styling while keeping the customer booking flow intact.
   ========================================================= */

(function () {
    'use strict';

    let allTeams = [];

    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatPrice(price) {
        return '\u20B9' + Number(price || 0).toLocaleString('en-IN');
    }

    function normalizePackage(pkg) {
        const workers = Array.isArray(pkg.workers)
            ? pkg.workers
            : (Array.isArray(pkg.team_members) ? pkg.team_members : []);

        return Object.assign({}, pkg, {
            workers: workers,
            size: workers.length,
        });
    }

    function renderCard(pkg) {
        const servicesLine = (pkg.services || [])
            .map(function (service) { return escapeHtml(service.name); })
            .join(' • ');

        const workerNames = (pkg.workers || [])
            .map(function (worker) {
                return escapeHtml(worker.full_name || worker.name || worker.profession || 'Team member');
            })
            .filter(Boolean);

        const teamHtml = workerNames.length
            ? '<div class="package-team-info">' +
                '<span class="package-team-label">Team</span>' +
                '<span class="package-team-members">' + workerNames.join(', ') + '</span>' +
              '</div>'
            : '';

        const metaTags = [];
        if (pkg.duration) {
            metaTags.push('<span class="package-meta-tag"><span class="package-meta-icon">◷</span>' + escapeHtml(pkg.duration) + '</span>');
        }
        if (pkg.location) {
            metaTags.push('<span class="package-meta-tag"><span class="package-meta-icon">⌖</span>' + escapeHtml(pkg.location) + '</span>');
        }
        if (pkg.availability) {
            metaTags.push('<span class="package-meta-tag"><span class="package-meta-icon">◫</span>' + escapeHtml(pkg.availability) + '</span>');
        }

        return (
            '<li>' +
                '<article class="package-card" tabindex="0" data-package-id="' + escapeHtml(String(pkg.id)) + '" aria-label="View ' + escapeHtml(pkg.name) + '">' +
                    '<div class="package-card-header">' +
                        '<div class="package-title-area">' +
                            '<h3 class="package-name">' + escapeHtml(pkg.name) + '</h3>' +
                            (pkg.description ? '<p class="package-description">' + escapeHtml(pkg.description) + '</p>' : '') +
                        '</div>' +
                        '<div class="package-price">' + formatPrice(pkg.price) + '</div>' +
                    '</div>' +
                    (servicesLine
                        ? '<div class="package-service-box">' +
                            '<span class="package-section-label">Services included</span>' +
                            '<p class="package-services">' + servicesLine + '</p>' +
                          '</div>'
                        : '') +
                    teamHtml +
                    (metaTags.length ? '<div class="package-meta-row">' + metaTags.join('') + '</div>' : '') +
                '</article>' +
            '</li>'
        );
    }

    function renderList(packages) {
        const list = document.getElementById('packageList');
        const empty = document.getElementById('emptyState');
        if (!list) return;
        list.innerHTML = packages.map(renderCard).join('');
        if (empty) empty.hidden = packages.length > 0;
    }

    function filteredTeams() {
        const search = document.getElementById('packageSearch');
        const select = document.getElementById('teamSizeSelect');
        const q = search ? String(search.value || '').trim().toLowerCase() : '';
        const sizeFilter = select ? String(select.value || 'all') : 'all';

        return allTeams.filter(function (pkg) {
            const searchable = [
                pkg.name,
                pkg.description,
                (pkg.services || []).map(function (service) { return service.name; }).join(' '),
                (pkg.workers || []).map(function (worker) { return worker.full_name || worker.name || worker.profession; }).join(' '),
            ].join(' ').toLowerCase();

            const matchesText = !q || searchable.includes(q);
            const matchesSize = sizeFilter === 'all' ||
                (sizeFilter === '5' ? pkg.size >= 5 : pkg.size === Number(sizeFilter));

            return matchesText && matchesSize;
        });
    }

    function applyFilters() {
        const empty = document.getElementById('emptyState');
        const filtered = filteredTeams();
        if (empty && !filtered.length) empty.textContent = 'No packages match your filters.';
        renderList(filtered);
    }

    function persistAndOpen(pkg) {
        if (!pkg) return;
        try {
            sessionStorage.setItem('handyhire.selectedTeam', pkg.name || 'Team Package');
            sessionStorage.setItem('handyhire.selectedPackageId', String(pkg.id));
            sessionStorage.setItem('handyhire.selectedTeamPackage', JSON.stringify(pkg));
            sessionStorage.setItem('handyhire.customer.previousPage', 'team-package.html');
        } catch (e) {}
        window.location.href = 'team-page.html?package_id=' + encodeURIComponent(String(pkg.id));
    }

    function initCardNavigation() {
        const list = document.getElementById('packageList');
        if (!list) return;

        function openFromCard(card) {
            const id = Number(card.getAttribute('data-package-id'));
            const pkg = allTeams.find(function (item) { return Number(item.id) === id; });
            persistAndOpen(pkg);
        }

        list.addEventListener('click', function (event) {
            const card = event.target.closest('.package-card');
            if (!card || !list.contains(card)) return;
            openFromCard(card);
        });

        list.addEventListener('keydown', function (event) {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            const card = event.target.closest('.package-card');
            if (!card || !list.contains(card)) return;
            event.preventDefault();
            openFromCard(card);
        });
    }

    function initBackButton() {
        const back = document.getElementById('backLink');
        if (!back) return;
        back.addEventListener('click', function (event) {
            event.preventDefault();
            window.location.href = 'home.html';
        });
    }

    async function loadTeams() {
        const list = document.getElementById('packageList');
        const loading = document.getElementById('loadingState');
        const error = document.getElementById('errorState');
        const empty = document.getElementById('emptyState');
        if (!list) return;

        if (loading) loading.hidden = false;
        if (error) error.hidden = true;
        if (empty) empty.hidden = true;
        list.innerHTML = '';

        if (!(window.HandyHireAPI && typeof window.HandyHireAPI.apiFetch === 'function')) {
            if (loading) loading.hidden = true;
            if (error) error.hidden = false;
            return;
        }

        try {
            const resp = await window.HandyHireAPI.apiFetch('/api/packages?package_type=team');
            if (!resp.ok) throw new Error('API returned ' + resp.status);
            const data = await resp.json();
            allTeams = (Array.isArray(data) ? data : []).map(normalizePackage);
            if (loading) loading.hidden = true;
            if (!allTeams.length) {
                if (empty) {
                    empty.textContent = 'No team packages available.';
                    empty.hidden = false;
                }
                return;
            }
            applyFilters();
        } catch (e) {
            allTeams = [];
            if (loading) loading.hidden = true;
            if (error) error.hidden = false;
            if (empty) empty.hidden = true;
        }
    }

    function init() {
        if (!(window.HandyHireAPI && window.HandyHireAPI.requireRole('customer'))) return;

        const search = document.getElementById('packageSearch');
        const select = document.getElementById('teamSizeSelect');
        if (search) search.addEventListener('input', applyFilters);
        if (select) select.addEventListener('change', applyFilters);

        initCardNavigation();
        initBackButton();
        loadTeams();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
