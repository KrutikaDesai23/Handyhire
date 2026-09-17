/* =========================================================
   HandyHire - Provider Request Page JavaScript
   Worker-side: manages customer booking requests.

   The PostgreSQL database (via the FastAPI backend) is the
   source of truth:
     GET  /api/worker/requests
     PUT  /api/worker/requests/{request_id}/accept
     PUT  /api/worker/requests/{request_id}/reject

   Renders the Pending / Accepted / Declined tabs, empty
   states, Accept/Decline buttons, and the in-page details
   modal. The legacy localStorage key is kept only as a
   compatibility snapshot for other worker pages' nav badge;
   it never overrides backend state and is not read as the
   source of truth on this page.
   ========================================================= */

(function () {
    'use strict';

    /* ---------------------------------------------------------
       Storage compatibility + badge sync
       --------------------------------------------------------- */
    const STORAGE_KEY = 'handyhire.workerRequests';
    const STATE_EVENT = 'handyhire:workerRequests-updated';

    function writeCompatSnapshot() {
        try {
            const snapshot = {};
            loadedRequests.forEach(function (req) {
                snapshot[req.id] = req.status;
            });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
        } catch (e) {
            // Storage may be unavailable (private mode) - keep going.
        }
        try {
            window.dispatchEvent(new CustomEvent(STATE_EVENT, {
                detail: { state: loadedRequests }
            }));
        } catch (e) {
            // CustomEvent unsupported - very old browser.
        }
    }

    /* ---------------------------------------------------------
       State (backend is the source of truth)
       --------------------------------------------------------- */
    let loadedRequests = [];

    /* ---------------------------------------------------------
       API helpers
       --------------------------------------------------------- */
    function getApi() {
        if (window.HandyHireAPI && typeof window.HandyHireAPI.apiFetch === 'function') {
            return window.HandyHireAPI;
        }
        return null;
    }

    function hasSession() {
        try {
            const token = localStorage.getItem('handyhire.auth.token');
            return Boolean(token && token.trim());
        } catch (e) {
            return false;
        }
    }

    function redirectToLogin() {
        try {
            sessionStorage.setItem('handyhire.provider.previousPage', 'provider-request.html');
        } catch (e) {
            // Ignore storage errors.
        }
        window.location.href = 'login.html';
    }

    /* ---------------------------------------------------------
       Backend -> UI mapping
       --------------------------------------------------------- */
function toUiStatus(backendStatus) {
    const s = String(backendStatus || 'pending').toLowerCase();

    if (s === 'rejected' || s === 'declined') {
        return 'declined';
    }

    if (s === 'accepted') {
        return 'accepted';
    }

    return 'pending';
}

    function formatDate(isoDate) {
        if (!isoDate) return '--';
        const text = String(isoDate).trim();
        const parts = text.split('-').map(Number);
        if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return parts[2] + ' ' + months[parts[1] - 1] + ' ' + parts[0];
        }
        return text;
    }

    function formatTime(time) {
        const text = String(time || '').trim();
        if (!text) return '--';
        const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
        if (match) {
            let hour = parseInt(match[1], 10);
            const minute = match[2];
            const suffix = hour >= 12 ? 'PM' : 'AM';
            hour = hour % 12 || 12;
            return hour + ':' + minute + ' ' + suffix;
        }
        return text;
    }

    function formatPrice(amount) {
        const n = Number(amount);
        if (!Number.isFinite(n) || n <= 0) return '--';
        return '\u20B9' + n.toLocaleString('en-IN');
    }

    function mapRequest(req) {
        const packageId = req.package_id || null;
        const packageName = req.package_name || null;
        const packageType = req.package_type || null;

        let bookingType = 'individual';
        if (packageType === 'team') {
            bookingType = 'team';
        } else if (packageType === 'multitasking') {
            bookingType = 'package';
        } else if (packageId) {
            bookingType = 'package';
        }

        return {
            id: req.id,
            bookingId: req.booking_id,
            status: toUiStatus(req.status),
            customer: req.customer_name || '--',
            service: req.service_name || '--',
            packageId: packageId,
            packageName: packageName,
            packageType: packageType,
            bookingType: bookingType,
            displayTitle: bookingType === 'team'
                ? (packageName || 'Team Package')
                : bookingType === 'package'
                    ? (packageName || 'Multitasking Package')
                    : (req.service_name || 'Service'),
            date: formatDate(req.booking_date),
            time: formatTime(req.booking_time),
            location: req.address || '--',
            price: formatPrice(req.amount),
            description: req.description || req.message || '--',
            beforePhotos: Array.isArray(req.before_photos) ? req.before_photos : [],
            teamMembers: Array.isArray(req.team_members) ? req.team_members : [],
        };
    }

    /* ---------------------------------------------------------
       UI helpers
       --------------------------------------------------------- */
    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function buildAvatar(name) {
        const initials = String(name || '?')
            .split(' ')
            .filter(Boolean)
            .map(function (part) { return part.charAt(0).toUpperCase(); })
            .slice(0, 2)
            .join('') || '?';

        const hue = Array.from(String(name)).reduce(
            function (sum, ch) { return sum + ch.charCodeAt(0); },
            0
        ) % 360;

        const svg =
            "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>" +
                "<defs>" +
                    "<linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>" +
                        "<stop offset='0%' stop-color='hsl(" + hue + ", 35%, 70%)'/>" +
                        "<stop offset='100%' stop-color='hsl(" + ((hue + 40) % 360) + ", 30%, 55%)'/>" +
                    "</linearGradient>" +
                "</defs>" +
                "<circle cx='32' cy='32' r='32' fill='url(#g)'/>" +
                "<text x='50%' y='54%' text-anchor='middle' font-family='Inter, sans-serif' " +
                      "font-size='24' font-weight='700' fill='#ffffff' dominant-baseline='middle'>" +
                    escapeHtml(initials) +
                "</text>" +
            "</svg>";

        return "url(\"data:image/svg+xml;utf8," + encodeURIComponent(svg) + "\")";
    }

    /* ---------------------------------------------------------
       Card rendering
       --------------------------------------------------------- */
    function renderCard(request, status) {
        const actions = (status === 'pending')
            ? "<div class='rq-actions'>" +
                  "<button type='button' class='rq-btn rq-btn--accept' data-action='accept' data-id='" + escapeHtml(request.id) + "'>Accept</button>" +
                  "<button type='button' class='rq-btn rq-btn--decline' data-action='decline' data-id='" + escapeHtml(request.id) + "'>Decline</button>" +
              "</div>"
            : "<div class='rq-actions'>" +
                  "<button type='button' class='rq-btn rq-btn--ghost' data-action='view' data-id='" + escapeHtml(request.id) + "'>View Details</button>" +
              "</div>";

        const statusBadge =
            "<span class='rq-card-status rq-card-status--" + escapeHtml(status) + "'>" +
                escapeHtml(status.charAt(0).toUpperCase() + status.slice(1)) +
            "</span>";

        const typeLabel = request.bookingType === 'team'
            ? 'TEAM PACKAGE'
            : request.bookingType === 'package'
                ? 'MULTITASKING PACKAGE'
                : 'INDIVIDUAL BOOKING';

        const typeBadge =
            "<span class='rq-card-type rq-card-type--" + escapeHtml(request.bookingType || 'individual') + "'>" +
                escapeHtml(typeLabel) +
            "</span>";

        const serviceLine = request.bookingType === 'package'
            ? "<p class='rq-card-service'>" + escapeHtml(request.displayTitle) + "</p>" +
              (request.packageName
                  ? "<p class='rq-card-service'>" + escapeHtml(request.packageName) + "</p>"
                  : '')
            : "<p class='rq-card-service'>" + escapeHtml(request.service) + "</p>";

        return (
            "<article class='rq-card' " +
                "data-request-id='" + escapeHtml(request.id) + "' " +
                "data-booking-id='" + escapeHtml(request.bookingId) + "' " +
                "data-status='" + escapeHtml(status) + "' " +
                "aria-label='Booking request from " + escapeHtml(request.customer) + "'>" +
                "<header class='rq-card-header'>" +
                    "<div class='rq-card-identity'>" +
                        "<span class='rq-card-avatar' style='background-image:" + buildAvatar(request.customer) + "' aria-hidden='true'></span>" +
                        "<div class='rq-card-id-text'>" +
                            "<h3 class='rq-card-customer'>" + escapeHtml(request.customer) + "</h3>" +
                            serviceLine +
                        "</div>" +
                    "</div>" +
                    "<div class='rq-card-badges'>" +
                        typeBadge +
                        statusBadge +
                    "</div>" +
                "</header>" +
                "<dl class='rq-card-grid'>" +
                    "<div><dt>Date</dt><dd>" + escapeHtml(request.date) + "</dd></div>" +
                    "<div><dt>Time</dt><dd>" + escapeHtml(request.time) + "</dd></div>" +
                    "<div><dt>Location</dt><dd>" + escapeHtml(request.location) + "</dd></div>" +
                    "<div><dt>Estimated Price</dt><dd class='rq-card-price'>" + escapeHtml(request.price) + "</dd></div>" +
                "</dl>" +
                "<p class='rq-card-desc'>" + escapeHtml(request.description) + "</p>" +
                actions +
            "</article>"
        );
    }

    function renderEmpty(label, hint) {
        return (
            "<div class='rq-empty' role='status'>" +
                "<p class='rq-empty-title'>" + escapeHtml(label) + "</p>" +
                "<p class='rq-empty-hint'>" + escapeHtml(hint) + "</p>" +
            "</div>"
        );
    }

    function renderLoading() {
        return (
            "<div class='rq-empty' role='status'>" +
                "<p class='rq-empty-title'>Loading requests...</p>" +
                "<p class='rq-empty-hint'>Fetching your latest booking requests.</p>" +
            "</div>"
        );
    }

    function renderError(message) {
        return (
            "<div class='rq-empty' role='status'>" +
                "<p class='rq-empty-title'>Unable to load requests</p>" +
                "<p class='rq-empty-hint'>" + escapeHtml(message) + "</p>" +
            "</div>"
        );
    }

    function renderTab(name, label, count) {
        return (
            "<button type='button' class='rq-tab' data-tab='" + escapeHtml(name) + "' " +
                    "role='tab' aria-selected='false'>" +
                "<span class='rq-tab-label'>" + escapeHtml(label) + "</span>" +
                "<span class='rq-tab-count'>" + Number(count) + "</span>" +
            "</button>"
        );
    }

    function renderModal(request, status) {
        const isPackage = request.bookingType === 'package' || request.bookingType === 'team';
        const typeLabel = request.bookingType === 'team'
            ? 'TEAM PACKAGE'
            : request.bookingType === 'package'
                ? 'MULTITASKING PACKAGE'
                : 'INDIVIDUAL BOOKING';
        const typeBadge =
            "<span class='rq-card-type rq-card-type--" + escapeHtml(request.bookingType || 'individual') + "'>" +
                escapeHtml(typeLabel) +
            "</span>";

        const modalStatusBadge =
            "<span class='rq-card-status rq-card-status--" + escapeHtml(status) + "'>" +
                escapeHtml(status.charAt(0).toUpperCase() + status.slice(1)) +
            "</span>";

        const serviceRow = isPackage
            ? "<div><dt>Package</dt><dd>" + escapeHtml(request.packageName || request.displayTitle || '--') + "</dd></div>" +
              "<div><dt>Service</dt><dd>" + escapeHtml(request.service) + "</dd></div>"
            : "<div><dt>Service</dt><dd>" + escapeHtml(request.service) + "</dd></div>";

        const photosHtml = (request.beforePhotos && request.beforePhotos.length)
            ? "<div class='rq-modal-photos'>" +
                  "<h4 class='rq-modal-photos-title'>Job Photos (Before)</h4>" +
                  "<div class='rq-modal-photos-grid'>" +
                      request.beforePhotos.map(function (photo) {
                          return "<div class='rq-modal-photo'><img src='" + escapeHtml(photo.image_url) + "' alt='Customer job photo' loading='lazy' /></div>";
                      }).join('') +
                  "</div>" +
              "</div>"
            : "";

        const teamHtml = (request.teamMembers && request.teamMembers.length)
            ? "<div class='rq-modal-team'>" +
                  "<h4 class='rq-modal-team-title'>Team</h4>" +
                  "<ul class='rq-modal-team-list'>" +
                      request.teamMembers.map(function (member) {
                          const leaderTag = member.is_leader ? ' <span class="rq-modal-team-leader">Team Leader</span>' : '';
                          const profession = member.profession ? ' &mdash; ' + escapeHtml(member.profession) : '';
                          return "<li>" + escapeHtml(member.full_name) + profession + leaderTag + "</li>";
                      }).join('') +
                  "</ul>" +
              "</div>"
            : "";

        return (
            "<div class='rq-modal' id='rqModal' role='dialog' aria-modal='true' aria-labelledby='rqModalTitle'>" +
                "<div class='rq-modal-backdrop' data-action='close-modal'></div>" +
                "<div class='rq-modal-card'>" +
                    "<header class='rq-modal-header'>" +
                        "<h2 class='rq-modal-title' id='rqModalTitle'>Request Details</h2>" +
                        "<div class='rq-modal-badges'>" +
                            typeBadge +
                            modalStatusBadge +
                        "</div>" +
                        "<button type='button' class='rq-modal-close' data-action='close-modal' aria-label='Close details'>&times;</button>" +
                    "</header>" +
                    "<dl class='rq-modal-grid'>" +
                        "<div><dt>Customer</dt><dd>" + escapeHtml(request.customer) + "</dd></div>" +
                        serviceRow +
                        "<div><dt>Date</dt><dd>" + escapeHtml(request.date) + "</dd></div>" +
                        "<div><dt>Time</dt><dd>" + escapeHtml(request.time) + "</dd></div>" +
                        "<div><dt>Location</dt><dd>" + escapeHtml(request.location) + "</dd></div>" +
                        "<div><dt>Price</dt><dd>" + escapeHtml(request.price) + "</dd></div>" +
                        "<div><dt>Status</dt><dd>" + escapeHtml(status) + "</dd></div>" +
                        "<div><dt>Request #</dt><dd>" + escapeHtml(request.id) + "</dd></div>" +
                    "</dl>" +
                    "<p class='rq-modal-desc'>" + escapeHtml(request.description) + "</p>" +
                    teamHtml +
                    photosHtml +
                "</div>" +
            "</div>"
        );
    }

    /* ---------------------------------------------------------
       Main render
       --------------------------------------------------------- */
    function countByStatus(status) {
        return loadedRequests.filter(function (r) { return r.status === status; }).length;
    }

    function render() {
        const lists = {
            pending: [],
            accepted: [],
            declined: [],
        };
        loadedRequests.forEach(function (req) {
            const status = toUiStatus(req.status);
            req.status = status;
            lists[status].push(req);
        });

        const tabsEl = document.getElementById('rqTabs');
        const panelEl = document.getElementById('rqPanel');
        if (!tabsEl || !panelEl) return;

        tabsEl.innerHTML =
            renderTab('pending',  'Pending',  lists.pending.length) +
            renderTab('accepted', 'Accepted', lists.accepted.length) +
            renderTab('declined', 'Declined', lists.declined.length);

        const activeTab = panelEl.dataset.tab || 'pending';
        const items = lists[activeTab] || [];

        Array.prototype.forEach.call(tabsEl.querySelectorAll('.rq-tab'), function (tab) {
            const isActive = tab.dataset.tab === activeTab;
            tab.classList.toggle('is-active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        if (!items.length) {
            const empty = (activeTab === 'pending')
                ? renderEmpty('No pending requests', 'New customer booking requests will appear here.')
                : (activeTab === 'accepted')
                    ? renderEmpty('No accepted requests', 'Accepted requests will appear here.')
                    : renderEmpty('No declined requests', 'Declined requests will appear here.');
            panelEl.innerHTML = empty;
            return;
        }

        panelEl.innerHTML = items.map(function (request) {
            return renderCard(request, activeTab);
        }).join('');
    }

    function setLoading() {
        const panelEl = document.getElementById('rqPanel');
        if (panelEl) panelEl.innerHTML = renderLoading();
    }

    /* ---------------------------------------------------------
       Modal helpers
       --------------------------------------------------------- */
    function closeModal() {
        const modal = document.getElementById('rqModal');
        if (modal) modal.remove();
    }

    function openModal(requestId) {
        closeModal();
        const request = loadedRequests.find(function (item) {
            return String(item.id) === String(requestId);
        });
        if (!request) return;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = renderModal(request, request.status);
        const modal = wrapper.firstElementChild;
        if (!modal) return;
        document.body.appendChild(modal);

        const closeBtn = modal.querySelector('.rq-modal-close');
        if (closeBtn) closeBtn.focus();
    }

    /* ---------------------------------------------------------
       Backend loading
       --------------------------------------------------------- */
    async function loadRequests() {
        const api = getApi();
        if (!api) {
            const panelEl = document.getElementById('rqPanel');
            if (panelEl) panelEl.innerHTML = renderError('API client unavailable.');
            return;
        }

        if (!hasSession()) {
            redirectToLogin();
            return;
        }

        setLoading();

        try {
            const response = await api.apiFetch('/api/worker/requests');
            if (response.status === 401 || response.status === 403) {
                redirectToLogin();
                return;
            }
            if (!response.ok) {
                throw new Error('Could not load requests.');
            }
            const rows = await response.json();
            loadedRequests = Array.isArray(rows) ? rows.map(mapRequest) : [];
            writeCompatSnapshot();
            render();
        } catch (error) {
            const panelEl = document.getElementById('rqPanel');
            if (panelEl) panelEl.innerHTML = renderError('Please check your connection and try again.');
        }
    }

    async function mutateRequest(requestId, action) {
        const api = getApi();
        if (!api) return;

        const suffix = action === 'accept' ? 'accept' : 'reject';
        const button = document.querySelector('[data-action="' + (action === 'accept' ? 'accept' : 'decline') + '"][data-id="' + requestId + '"]');
        if (button) {
            button.disabled = true;
            button.textContent = action === 'accept' ? 'Accepting...' : 'Declining...';
        }

        try {
            const response = await api.apiFetch('/api/worker/requests/' + encodeURIComponent(String(requestId)) + '/' + suffix, {
                method: 'PUT'
            });
            if (response.status === 401 || response.status === 403) {
                redirectToLogin();
                return;
            }
            if (!response.ok) {
                let detail = 'Unable to update request.';
                try {
                    const data = await response.json();
                    detail = data && data.detail ? data.detail : detail;
                } catch (e) {
                    // Keep default error.
                }
                throw new Error(detail);
            }
            await loadRequests();
        } catch (error) {
            if (button) {
                button.disabled = false;
                button.textContent = action === 'accept' ? 'Accept' : 'Decline';
            }
            window.alert(error && error.message ? error.message : 'Unable to update request.');
        }
    }

    /* ---------------------------------------------------------
       Events
       --------------------------------------------------------- */
    document.addEventListener('click', function (event) {
        const tab = event.target.closest('.rq-tab');
        if (tab) {
            const panelEl = document.getElementById('rqPanel');
            if (panelEl) panelEl.dataset.tab = tab.dataset.tab || 'pending';
            render();
            return;
        }

        const actionButton = event.target.closest('[data-action]');
        if (!actionButton) return;

        const action = actionButton.dataset.action;
        const requestId = actionButton.dataset.id;

        if (action === 'accept' || action === 'decline') {
            mutateRequest(requestId, action === 'accept' ? 'accept' : 'reject');
            return;
        }

        if (action === 'view') {
            openModal(requestId);
            return;
        }

        if (action === 'close-modal') {
            closeModal();
        }
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') closeModal();
    });

    document.addEventListener('DOMContentLoaded', loadRequests);
})();
