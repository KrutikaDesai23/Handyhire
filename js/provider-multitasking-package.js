/* =========================================================
   HandyHire - Provider Multitasking Packages JavaScript
   Supports Explore and My Packages tabs. Fetches real data
   from the backend and renders cards with manage controls
   for owned packages.
   ========================================================= */

(function () {
    'use strict';

    const api = window.HandyHireAPI;
    if (!api) return;

    let currentTab = 'explore';
    let allPackages = [];
    let myPackages = [];
    var legacyPublishStarted = false;

    /**
     * Parse query string parameters.
     */
    function getQueryParams() {
        var params = {};
        var qs = window.location.search.substring(1);
        if (!qs) return params;
        qs.split('&').forEach(function (part) {
            var pair = part.split('=');
            if (pair.length === 2) {
                params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
            }
        });
        return params;
    }

    /**
     * Escape text for safe HTML injection.
     */
    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Build a placeholder avatar data URL.
     */
    function buildAvatar(name) {
        var clean = String(name || '?').trim() || '?';
        var initials = clean
            .split(' ')
            .filter(Boolean)
            .map(function (part) { return part.charAt(0).toUpperCase(); })
            .slice(0, 2)
            .join('') || '?';

        var hue = Array.from(clean).reduce(
            function (sum, ch) { return sum + ch.charCodeAt(0); },
            0
        ) % 360;

        var svg = '<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 80 80\'>' +
            '<defs><linearGradient id=\'g\' x1=\'0\' y1=\'0\' x2=\'1\' y2=\'1\'>' +
            '<stop offset=\'0%\' stop-color=\'hsl(' + hue + ', 35%, 70%)\'/>' +
            '<stop offset=\'100%\' stop-color=\'hsl(' + ((hue + 40) % 360) + ', 30%, 55%)\'/>' +
            '</linearGradient></defs>' +
            '<circle cx=\'40\' cy=\'40\' r=\'40\' fill=\'url(#g)\'/>' +
            '<text x=\'50%\' y=\'54%\' text-anchor=\'middle\' font-family=\'Inter, sans-serif\' font-size=\'30\' font-weight=\'700\' fill=\'#ffffff\' dominant-baseline=\'middle\'>' + initials + '</text>' +
            '</svg>';

        return 'url("data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '")';
    }

    /**
     * Format a price for display.
     */
    function formatPrice(price) {
        return '\u20B9' + Number(price || 0).toLocaleString();
    }

    function findPackageById(packageId) {
    var source =
        currentTab === 'mine'
            ? myPackages
            : allPackages;

    return source.find(function (pkg) {
        return Number(pkg.id) === Number(packageId);
    }) || null;
}


function openPackageBooking(pkg) {

    // Only packages in Explore can be booked.
    if (!pkg || currentTab !== 'explore') {
        return;
    }

    try {
        sessionStorage.setItem(
            'handyhire.bookingPackage',
            JSON.stringify(pkg)
        );

        sessionStorage.setItem(
            'handyhire.provider.bookingBackPage',
            window.location.href
        );

        sessionStorage.setItem(
            'handyhire.provider.previousPage',
            'provider-multitasking-package.html'
        );
    } catch (error) {
        console.error(
            'Unable to store package:',
            error
        );
    }

    window.location.href =
        'provider-booking.html?package_id=' +
        encodeURIComponent(pkg.id);
}
    /**
     * Show a status badge class.
     */
    function statusBadgeClass(status) {
        var s = String(status || '').toLowerCase();
        if (s === 'published') return 'status-published';
        if (s === 'archived') return 'status-archived';
        return 'status-draft';
    }

    /**
     * Render a single package card as an <li>.
     */
 function renderCard(pkg, isMine) {

    var servicesLine = (pkg.services || [])
        .map(function (service) {
            return escapeHtml(service.name);
        })
        .join(' • ');


    var metaTags = [];

    if (pkg.duration) {
        metaTags.push(
            '<span class="package-meta-tag">' +
                '<span class="package-meta-icon">⏱</span>' +
                escapeHtml(pkg.duration) +
            '</span>'
        );
    }

    if (pkg.location) {
        metaTags.push(
            '<span class="package-meta-tag">' +
                '<span class="package-meta-icon">⌖</span>' +
                escapeHtml(pkg.location) +
            '</span>'
        );
    }

    if (pkg.availability) {
        metaTags.push(
            '<span class="package-meta-tag">' +
                '<span class="package-meta-icon">◷</span>' +
                escapeHtml(pkg.availability) +
            '</span>'
        );
    }


    var controlsHtml = '';

    if (isMine) {

        var editHref =
            'provider-create-package.html' +
            '?type=multitasking' +
            '&package_id=' +
            pkg.id;

        controlsHtml =
            '<div class="package-controls">' +

                '<a href="' +
                    editHref +
                    '" class="btn-sm btn-edit">' +
                    'Edit' +
                '</a>' +

                '<button ' +
                    'type="button" ' +
                    'class="btn-sm btn-delete" ' +
                    'data-action="archive" ' +
                    'data-id="' +
                    pkg.id +
                    '">' +
                    'Delete' +
                '</button>' +

            '</div>';
    }


    return (
        '<li>' +

'<article ' +
    'class="package-card" ' +
    'tabindex="0" ' +
    'data-package-id="' +
    pkg.id +
    '" ' +
    'aria-label="View ' +
    escapeHtml(pkg.name) +
    '">' +


                '<div class="package-card-header">' +

                    '<div class="package-title-area">' +

                        '<h3 class="package-name">' +
                            escapeHtml(pkg.name) +
                        '</h3>' +

                        (
                            pkg.description
                                ? '<p class="package-description">' +
                                    escapeHtml(pkg.description) +
                                  '</p>'
                                : ''
                        ) +

                    '</div>' +


                    '<div class="package-price">' +
                        formatPrice(pkg.price) +
                    '</div>' +

                '</div>' +


                (
                    servicesLine
                        ? '<div class="package-service-box">' +

                            '<span class="package-section-label">' +
                                'Services included' +
                            '</span>' +

                            '<p class="package-services">' +
                                servicesLine +
                            '</p>' +

                          '</div>'
                        : ''
                ) +


                (
                    metaTags.length
                        ? '<div class="package-meta-row">' +
                            metaTags.join('') +
                          '</div>'
                        : ''
                ) +


                controlsHtml +

            '</article>' +

        '</li>'
    );
}

    /**
     * Render the full package list into the container.
     */
    function renderList(packages, container, emptyState) {
        container.innerHTML = packages.map(function (pkg) {
            return renderCard(pkg, currentTab === 'mine');
        }).join('');
        if (emptyState) emptyState.hidden = packages.length > 0;

        container.querySelectorAll('[data-action="publish"]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                publishPackage(Number(btn.getAttribute('data-id')));
            });
        });
        container.querySelectorAll('[data-action="unpublish"]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                unpublishPackage(Number(btn.getAttribute('data-id')));
            });
        });
        container.querySelectorAll('[data-action="archive"]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                archivePackage(Number(btn.getAttribute('data-id')));
            });
        });
        if (currentTab === 'explore') {

    container
        .querySelectorAll(
            '.package-card[data-package-id]'
        )
        .forEach(function (card) {

            function openCard(event) {

                if (
                    event.target.closest(
                        '.package-controls'
                    )
                ) {
                    return;
                }

                var packageId =
                    Number(
                        card.getAttribute(
                            'data-package-id'
                        )
                    );

                var pkg =
                    findPackageById(packageId);

                openPackageBooking(pkg);
            }


            card.addEventListener(
                'click',
                openCard
            );


            card.addEventListener(
                'keydown',
                function (event) {

                    if (
                        event.key === 'Enter' ||
                        event.key === ' '
                    ) {
                        event.preventDefault();
                        openCard(event);
                    }
                }
            );
        });
}
    }

    /**
     * Fetch explore packages (published, multitasking type).
     */
    function fetchExplore() {
        var list = document.getElementById('packageList');
        var empty = document.getElementById('emptyState');
        var loading = document.getElementById('loadingState');
        var error = document.getElementById('errorState');
        if (loading) loading.hidden = false;
        if (error) error.hidden = true;
        if (list) list.innerHTML = '';
        if (empty) empty.hidden = true;

        return api.apiFetch('/api/packages?package_type=multitasking').then(function (response) {
            if (!response.ok) throw new Error('Failed to load explore packages');
            return response.json();
        }).then(function (data) {
            allPackages = data || [];
            if (loading) loading.hidden = true;
            applyFilter();
        }).catch(function () {
            allPackages = [];
            if (loading) loading.hidden = true;
            if (error) error.hidden = false;
            if (empty) empty.hidden = true;
            if (list) list.innerHTML = '';
        });
    }

    /**
      * Auto-publish any provider-owned draft packages that
      * pre-date the published-default change. Runs at most
      * once per session; failures are logged but do not
      * block the package list from rendering.
      */
    function publishLegacyDrafts() {
        if (legacyPublishStarted) return;
        legacyPublishStarted = true;

        var drafts = myPackages.filter(function (pkg) {
            return String(pkg.status || '').toLowerCase() === 'draft';
        });

        if (!drafts.length) return;

        drafts.forEach(function (pkg) {
            api.apiFetch('/api/worker/packages/' + pkg.id + '/publish', { method: 'PATCH' })
                .then(function (response) {
                    if (response.status === 401 || response.status === 403) {
                        return;
                    }
                    if (!response.ok) {
                        console.warn('Auto-publish failed for package', pkg.id);
                    }
                })
                .catch(function () {
                    console.warn('Auto-publish error for package', pkg.id);
                });
        });
    }

    /**
     * Fetch my packages (all statuses for current worker).
     */
    function fetchMyPackages() {
        var list = document.getElementById('packageList');
        var empty = document.getElementById('emptyState');
        var loading = document.getElementById('loadingState');
        var error = document.getElementById('errorState');
        if (loading) loading.hidden = false;
        if (error) error.hidden = true;
        if (list) list.innerHTML = '';
        if (empty) empty.hidden = true;

        return api.apiFetch('/api/worker/packages').then(function (response) {
            if (response.status === 401 || response.status === 403) {
                api.clearAuth();
                window.location.href = 'login.html';
                return [];
            }
            if (!response.ok) throw new Error('Failed to load my packages');
            return response.json();
        }).then(function (data) {
            myPackages = (data || []).filter(function (pkg) {
    return pkg.package_type === 'multitasking';
});
            publishLegacyDrafts();
            if (loading) loading.hidden = true;
            applyFilter();
        }).catch(function () {
            myPackages = [];
            if (loading) loading.hidden = true;
            if (error) error.hidden = false;
            if (empty) empty.hidden = true;
            if (list) list.innerHTML = '';
        });
    }

    /**
     * Apply the current search filter to the active tab data.
     */
    function applyFilter() {
        var list = document.getElementById('packageList');
        var empty = document.getElementById('emptyState');
        var error = document.getElementById('errorState');
        var searchInput = document.getElementById('packageSearch');
        var q = searchInput ? String(searchInput.value || '').trim().toLowerCase() : '';

        var source = currentTab === 'explore' ? allPackages : myPackages;
        var filtered = source;
        if (q) {
            filtered = source.filter(function (pkg) {
                return pkg.name.toLowerCase().includes(q) ||
                    (pkg.description || '').toLowerCase().includes(q) ||
                    (pkg.services || []).some(function (s) { return s.name.toLowerCase().includes(q); });
            });
        }

        if (error) error.hidden = true;
        renderList(filtered, list, empty);
    }

    /**
     * Publish a draft package.
     */
    function publishPackage(packageId) {
        if (!confirm('Publish this package? It will be visible to customers in Explore.')) return;
        api.apiFetch('/api/worker/packages/' + packageId + '/publish', { method: 'PATCH' }).then(function (response) {
            if (response.status === 401 || response.status === 403) {
                api.clearAuth();
                window.location.href = 'login.html';
                return;
            }
            if (!response.ok) {
                return response.json().then(function (err) {
                    throw new Error(err && err.detail ? err.detail : 'Failed to publish');
                }).catch(function () { throw new Error('Failed to publish'); });
            }
            return response.json();
        }).then(function (data) {
            if (!data) return;
            var idx = myPackages.findIndex(function (p) { return p.id === packageId; });
            if (idx >= 0) myPackages[idx] = data;
            if (currentTab === 'mine') applyFilter();
        }).catch(function (err) {
            alert(err && err.message ? err.message : 'Failed to publish package');
        });
    }

    /**
     * Unpublish a published package.
     */
    function unpublishPackage(packageId) {
        if (!confirm('Unpublish this package? It will be hidden from Explore.')) return;
        api.apiFetch('/api/worker/packages/' + packageId + '/unpublish', { method: 'PATCH' }).then(function (response) {
            if (response.status === 401 || response.status === 403) {
                api.clearAuth();
                window.location.href = 'login.html';
                return;
            }
            if (!response.ok) {
                return response.json().then(function (err) {
                    throw new Error(err && err.detail ? err.detail : 'Failed to unpublish');
                }).catch(function () { throw new Error('Failed to unpublish'); });
            }
            return response.json();
        }).then(function (data) {
            if (!data) return;
            var idx = myPackages.findIndex(function (p) { return p.id === packageId; });
            if (idx >= 0) myPackages[idx] = data;
            if (currentTab === 'mine') applyFilter();
        }).catch(function (err) {
            alert(err && err.message ? err.message : 'Failed to unpublish package');
        });
    }

    /**
     * Archive a package.
     */
    function archivePackage(packageId) {
        if (!confirm('Archive this package? This action cannot be undone.')) return;
        api.apiFetch('/api/worker/packages/' + packageId, { method: 'DELETE' }).then(function (response) {
            if (response.status === 401 || response.status === 403) {
                api.clearAuth();
                window.location.href = 'login.html';
                return;
            }
            if (!response.ok) {
                return response.json().then(function (err) {
                    throw new Error(err && err.detail ? err.detail : 'Failed to archive');
                }).catch(function () { throw new Error('Failed to archive'); });
            }
            myPackages = myPackages.filter(function (p) { return p.id !== packageId; });
            applyFilter();
        }).catch(function (err) {
            alert(err && err.message ? err.message : 'Failed to archive package');
        });
    }

    /**
     * Switch the active tab.
     */
    function switchTab(tab) {
        currentTab = tab;
        document.querySelectorAll('.tab-btn').forEach(function (btn) {
            btn.classList.toggle('is-active', btn.getAttribute('data-tab') === tab);
        });
        var createRow = document.getElementById('createRow');
        if (createRow) createRow.hidden = tab !== 'mine';
        applyFilter();
        if (tab === 'explore') {
            fetchExplore();
        } else {
            fetchMyPackages();
        }
    }

    /**
     * Initialize the page.
     */
    function init() {
        if (!api.requireRole('worker')) return;

        var tabExplore = document.getElementById('tabExplore');
        var tabMine = document.getElementById('tabMine');

        tabExplore.addEventListener('click', function () { switchTab('explore'); });
        tabMine.addEventListener('click', function () { switchTab('mine'); });

        var searchInput = document.getElementById('packageSearch');
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                applyFilter();
            });
        }

        switchTab('explore');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
