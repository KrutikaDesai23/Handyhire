/* =========================================================
   HandyHire - Team Package booking bridge
   Keeps the shared customer Booking page while routing Team
   Packages through the dedicated backend flow.
   ========================================================= */

(function () {
    'use strict';

    var api = window.HandyHireAPI;
    if (!api || typeof api.apiFetch !== 'function') return;

    var params;
    try {
        params = new URLSearchParams(window.location.search);
    } catch (e) {
        return;
    }

    var packageId = params.get('package_id');
    if (!packageId) return;

    var originalApiFetch = api.apiFetch.bind(api);
    var packagePromise = null;
    var teamPackage = null;
    var lastTeamError = '';
    var renderQueued = false;

    function loadPackage() {
        if (packagePromise) return packagePromise;

        packagePromise = originalApiFetch(
            '/api/packages/' + encodeURIComponent(String(packageId))
        )
            .then(function (response) {
                if (!response.ok) return null;
                return response.json();
            })
            .then(function (pkg) {
                if (pkg && pkg.package_type === 'team') {
                    teamPackage = pkg;
                    return pkg;
                }
                return null;
            })
            .catch(function () {
                return null;
            });

        return packagePromise;
    }

    function getHours() {
        var select = document.getElementById('hoursSelect');
        return Math.max(1, Number(select && select.value) || 1);
    }

    function formatRupees(value) {
        return '\u20B9' + Number(value || 0).toLocaleString('en-IN');
    }

    function renderTeamPackageUi() {
        if (!teamPackage) return;

        var mode = document.getElementById('workerMode');
        if (mode && mode.textContent !== 'Booking: Team Package') {
            mode.textContent = 'Booking: Team Package';
            mode.hidden = false;
        }

        var total = document.getElementById('totalCost');
        var help = document.getElementById('totalHelp');
        var select = document.getElementById('hoursSelect');
        var selectedHours = Number(select && select.value);
        var basePrice = Number(teamPackage.price) || 0;

        if (total) {
            var totalText = selectedHours > 0
                ? formatRupees(basePrice * selectedHours)
                : '\u2014';
            if (total.textContent !== totalText) total.textContent = totalText;
        }

        if (help) {
            var helpText = selectedHours > 0
                ? formatRupees(basePrice) + ' / hour \u00d7 ' + selectedHours + (selectedHours === 1 ? ' hour' : ' hours')
                : 'Select hours to calculate the Team Package total at ' + formatRupees(basePrice) + ' / hour.';
            if (help.textContent !== helpText) help.textContent = helpText;
        }
    }

    function queueRender() {
        if (renderQueued) return;
        renderQueued = true;
        window.requestAnimationFrame(function () {
            renderQueued = false;
            renderTeamPackageUi();
        });
    }

    api.apiFetch = function (path, options) {
        var isBookingCreate = (
            path === '/api/bookings' &&
            options &&
            String(options.method || 'GET').toUpperCase() === 'POST'
        );

        if (!isBookingCreate) {
            return originalApiFetch(path, options);
        }

        return loadPackage().then(function (pkg) {
            if (!pkg) {
                return originalApiFetch(path, options);
            }

            var nextOptions = Object.assign({}, options);
            var payload = {};
            try {
                payload = JSON.parse(String(options.body || '{}'));
            } catch (e) {
                payload = {};
            }

            var hours = getHours();
            payload.package_id = Number(pkg.id);
            payload.hours = hours;
            payload.amount = (Number(pkg.price) || 0) * hours;
            delete payload.worker_id;
            delete payload.team_id;

            nextOptions.body = JSON.stringify(payload);

            return originalApiFetch('/api/bookings/team-package', nextOptions)
                .then(function (response) {
                    if (response.status === 400 || response.status === 409) {
                        response.clone().json()
                            .then(function (body) {
                                lastTeamError = body && body.detail
                                    ? String(body.detail)
                                    : '';
                            })
                            .catch(function () {});
                    } else {
                        lastTeamError = '';
                    }
                    return response;
                });
        });
    };

    function init() {
        loadPackage().then(function (pkg) {
            if (!pkg) return;

            renderTeamPackageUi();

            var select = document.getElementById('hoursSelect');
            if (select) {
                select.addEventListener('change', renderTeamPackageUi);
            }

            var mode = document.getElementById('workerMode');
            var total = document.getElementById('totalCost');
            var help = document.getElementById('totalHelp');
            [mode, total, help].forEach(function (node) {
                if (!node) return;
                new MutationObserver(queueRender).observe(node, {
                    childList: true,
                    characterData: true,
                    subtree: true,
                });
            });

            var error = document.getElementById('bookingError');
            if (error) {
                new MutationObserver(function () {
                    if (!error.hidden && lastTeamError) {
                        error.textContent = lastTeamError;
                    }
                }).observe(error, {
                    attributes: true,
                    childList: true,
                    characterData: true,
                    subtree: true,
                });
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
