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

    // Booking payloads already include package_id and hours from booking.js.
    // Keep this bridge limited to display enhancements so a package lookup
    // can never hold the booking POST request open.

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
