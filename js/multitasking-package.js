/* =========================================================
   HandyHire - Customer Multitasking Packages
   Uses the provider package card structure and state blocks
   while preserving customer booking navigation.
   ========================================================= */

(function () {
    'use strict';

    let allPackages = [];

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

    function renderCard(pkg) {
        const servicesLine = (pkg.services || [])
            .map(function (service) { return escapeHtml(service.name); })
            .join(' • ');

        const metaTags = [];
        if (pkg.duration) {
            metaTags.push('<span class="package-meta-tag"><span class="package-meta-icon">⏱</span>' + escapeHtml(pkg.duration) + '</span>');
        }
        if (pkg.location) {
            metaTags.push('<span class="package-meta-tag"><span class="package-meta-icon">⌖</span>' + escapeHtml(pkg.location) + '</span>');
        }
        if (pkg.availability) {
            metaTags.push('<span class="package-meta-tag"><span class="package-meta-icon">◷</span>' + escapeHtml(pkg.availability) + '</span>');
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

    function applyFilter() {
        const input = document.getElementById('packageSearch');
        const empty = document.getElementById('emptyState');
        const q = input ? String(input.value || '').trim().toLowerCase() : '';
        const filtered = !q ? allPackages.slice() : allPackages.filter(function (pkg) {
            const searchable = [
                pkg.name,
                pkg.description,
                (pkg.services || []).map(function (service) { return service.name; }).join(' '),
            ].join(' ').toLowerCase();
            return searchable.includes(q);
        });
        if (empty && !filtered.length) empty.textContent = 'No packages match your search.';
        renderList(filtered);
    }

    function initCardNavigation() {
        const list = document.getElementById('packageList');
        if (!list) return;

        function openCard(card) {
            const packageId = card.getAttribute('data-package-id');
            if (!packageId) return;
            try {
                sessionStorage.setItem('handyhire.customer.previousPage', 'multitasking-package.html');
            } catch (e) {}
            window.location.href = 'booking.html?package_id=' + encodeURIComponent(packageId);
        }

        list.addEventListener('click', function (event) {
            const card = event.target.closest('.package-card');
            if (!card || !list.contains(card)) return;
            openCard(card);
        });

        list.addEventListener('keydown', function (event) {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            const card = event.target.closest('.package-card');
            if (!card || !list.contains(card)) return;
            event.preventDefault();
            openCard(card);
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

    async function loadPackages() {
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
            const response = await window.HandyHireAPI.apiFetch('/api/packages?package_type=multitasking');
            if (!response.ok) throw new Error('API returned ' + response.status);
            const data = await response.json();
            allPackages = Array.isArray(data) ? data.slice() : [];
            if (loading) loading.hidden = true;

            if (!allPackages.length) {
                if (empty) {
                    empty.textContent = 'No packages available.';
                    empty.hidden = false;
                }
                return;
            }
            applyFilter();
        } catch (e) {
            allPackages = [];
            if (loading) loading.hidden = true;
            if (error) error.hidden = false;
            if (empty) empty.hidden = true;
        }
    }

    function init() {
        if (!(window.HandyHireAPI && window.HandyHireAPI.requireRole('customer'))) return;

        const input = document.getElementById('packageSearch');
        if (input) input.addEventListener('input', applyFilter);
        initCardNavigation();
        initBackButton();
        loadPackages();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
