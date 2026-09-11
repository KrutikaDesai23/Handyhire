/* =========================================================
   HandyHire - Provider Booking Details JavaScript
   ========================================================= */

(function () {
    'use strict';

    const STATUS_FLOW = [
        { key: 'pending', label: 'Requested' },
        { key: 'accepted', label: 'Accepted' },
        { key: 'confirmed', label: 'Accepted' },
        { key: 'in_progress', label: 'In Progress' },
        { key: 'completion_requested', label: 'Completion Requested' },
        { key: 'completed', label: 'Completed' },
    ];

    const TERMINAL_STATUSES = new Set(['rejected', 'cancelled', 'completed']);

    function getApi() {
        return (window.HandyHireAPI && typeof window.HandyHireAPI.apiFetch === 'function')
            ? window.HandyHireAPI
            : null;
    }

    function redirectToLogin() {
        try {
            sessionStorage.setItem('handyhire.provider.previousPage', 'provider-booking-details.html');
        } catch (e) {}
        window.location.href = 'login.html';
    }

    function getQueryParams() {
        const params = new URLSearchParams(window.location.search);
        const rawId = params.get('booking_id');
        const mode = params.get('mode');
        const bookingId = rawId ? parseInt(rawId, 10) : NaN;
        return {
            bookingId: Number.isFinite(bookingId) && bookingId > 0 ? bookingId : null,
            mode: (mode === 'received' || mode === 'sent') ? mode : null,
        };
    }

    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatCurrency(amount) {
        const num = Number(amount);
        return Number.isFinite(num)
            ? '\u20B9' + num.toLocaleString('en-IN')
            : '--';
    }

    function normalizePhone(raw) {
        if (!raw) return null;
        let digits = String(raw).replace(/[^0-9]/g, '');
        if (digits.length === 10) {
            digits = '91' + digits;
        }
        return digits;
    }

    function formatDate(value) {
        if (!value) return '--';
        const date = new Date(value + 'T00:00:00');
        if (isNaN(date.getTime())) return '--';
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
    }

    function formatTime(value) {
        if (!value) return '--';
        const text = String(value).trim();
        const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
        if (!match) return text || '--';
        let hour = parseInt(match[1], 10);
        const suffix = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12 || 12;
        return hour + ':' + match[2] + ' ' + suffix;
    }

    function getStatusClass(status) {
        const key = String(status || 'pending').toLowerCase();
        const map = {
            pending: 'detail-status--pending',
            accepted: 'detail-status--accepted',
            confirmed: 'detail-status--confirmed',
            in_progress: 'detail-status--in-progress',
            rejected: 'detail-status--rejected',
            cancelled: 'detail-status--cancelled',
            completed: 'detail-status--completed',
            completion_requested: 'detail-status--pending',
        };
        return map[key] || 'detail-status--pending';
    }

    function show(selector) {
        const el = document.getElementById(selector);
        if (el) el.hidden = false;
    }

    function hide(selector) {
        const el = document.getElementById(selector);
        if (el) el.hidden = true;
    }

    function showLoading() {
        hide('errorState');
        hide('unauthorizedState');
        hide('invalidModeState');
        hide('bookingDetails');
        show('loadingState');
    }

    function showError(message) {
        hide('loadingState');
        hide('unauthorizedState');
        hide('invalidModeState');
        hide('bookingDetails');
        const el = document.getElementById('errorState');
        if (el) {
            el.textContent = message;
            el.hidden = false;
        }
    }

    function showUnauthorized() {
        hide('loadingState');
        hide('errorState');
        hide('invalidModeState');
        hide('bookingDetails');
        show('unauthorizedState');
    }

    function showInvalidMode() {
        hide('loadingState');
        hide('errorState');
        hide('unauthorizedState');
        hide('bookingDetails');
        show('invalidModeState');
    }

    function showDetails() {
        hide('loadingState');
        hide('errorState');
        hide('unauthorizedState');
        hide('invalidModeState');
        show('bookingDetails');
    }

    function renderStatusTimeline(status) {
        const container = document.getElementById('statusTimeline');
        if (!container) return;

        const key = String(status || 'pending').toLowerCase();
        const currentIndex = STATUS_FLOW.findIndex(function (s) { return s.key === key; });

        container.innerHTML = STATUS_FLOW.map(function (step, index) {
            let cls = 'timeline-item';
            if (index === currentIndex) cls += ' is-active';
            if (index < currentIndex) cls += ' is-completed';
            return '<div class="' + cls + '">' + escapeHtml(step.label) + '</div>';
        }).join('');
    }

    function renderPackageServices(services) {
        const section = document.getElementById('packageServicesSection');
        const list = document.getElementById('packageServicesList');
        if (!section || !list) return;

        if (!services || !services.length) {
            section.hidden = true;
            return;
        }

        section.hidden = false;
        list.innerHTML = services.map(function (svc) {
            return '<li>' + escapeHtml(svc.name) + ' <span style="color:var(--color-text-muted);font-weight:500;">(' + formatCurrency(svc.base_price) + ')</span></li>';
        }).join('');
    }

    function renderTeamMembers(members) {
        const section = document.getElementById('teamMembersSection');
        const list = document.getElementById('teamMembersList');
        if (!section || !list) return;

        if (!members || !members.length) {
            section.hidden = true;
            return;
        }

        section.hidden = false;
        list.innerHTML = members.map(function (member) {
            const leaderTag = member.is_leader ? ' <span style="font-size:11px;font-weight:700;color:var(--color-primary);">&#10003; Team Leader</span>' : '';
            const profession = member.profession
                ? '<span class="member-profession">' + escapeHtml(member.profession) + '</span>'
                : '';
            return '<li class="team-member-item">' +
                '<span class="team-member-name">' + escapeHtml(member.full_name) + leaderTag + '</span>' +
                profession +
                ' <span style="color:var(--color-text-muted);font-weight:500;">- ' + escapeHtml(member.status) + '</span>' +
                '</li>';
        }).join('');
    }

    function renderContactCard(data, mode) {
        const contactNameEl = document.getElementById('contactName');
        const contactImageEl = document.getElementById('contactImage');
        const contactInitialEl = document.getElementById('contactInitial');
        const contactNoteEl = document.getElementById('contactAvailability');
        const callBtn = document.getElementById('callButton');
        const waBtn = document.getElementById('whatsappButton');
        const mapsBtn = document.getElementById('mapsButton');

        const isReceived = mode === 'received';
        const name = isReceived ? (data.customer_name || '--') : (data.worker_name || '--');
        const phone = isReceived ? data.customer_phone : data.worker_phone;
        const image = isReceived ? data.customer_image : data.worker_image;

        if (contactNameEl) contactNameEl.textContent = name;

        if (image) {
            contactImageEl.src = image;
            contactImageEl.alt = (name || 'Contact') + ' photo';
            contactImageEl.hidden = false;
            contactInitialEl.hidden = true;
        } else {
            contactImageEl.hidden = true;
            contactInitialEl.hidden = false;
            contactInitialEl.textContent = name.charAt(0).toUpperCase();
        }

        const activeStatuses = ['accepted', 'confirmed', 'completion_requested'];
        const hasPhone = activeStatuses.includes(String(data.status || '').toLowerCase());
        const normalized = normalizePhone(phone);

        if (hasPhone && normalized) {
            contactNoteEl.textContent = 'Contact available';
            callBtn.href = 'tel:' + normalized;
            callBtn.disabled = false;
            callBtn.classList.remove('is-disabled');

            const message = encodeURIComponent('Hello, I am contacting you regarding my HandyHire booking #' + data.id + '.');
            waBtn.href = 'https://wa.me/' + normalized + '?text=' + message;
            waBtn.disabled = false;
            waBtn.classList.remove('is-disabled');
        } else {
            contactNoteEl.textContent = 'Contact available after booking acceptance';
            callBtn.href = '#';
            callBtn.disabled = true;
            callBtn.classList.add('is-disabled');

            waBtn.href = '#';
            waBtn.disabled = true;
            waBtn.classList.add('is-disabled');
        }

        const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(data.address || '');
        mapsBtn.href = mapsUrl;
    }

    function renderPhotoGrid(containerId, photos) {
        const grid = document.getElementById(containerId);
        if (!grid) return;
        if (!photos || !photos.length) {
            grid.innerHTML = '';
            return;
        }
        grid.innerHTML = photos.map(function (photo) {
            var src = escapeHtml(photo.image_url || '');
            return (
                "<div class='photo-grid-item'>" +
                    "<img src='" + src + "' alt='Job photo' loading='lazy' onerror=\"this.parentNode.innerHTML='<div class=\\'photo-grid-item photo-grid-item--fallback\\'>Unavailable</div>'\" />" +
                "</div>"
            );
        }).join('');
    }

    function renderJobPhotos(data) {
        const section = document.getElementById('jobPhotosSection');
        if (!section) return;

        const before = data.before_photos || [];
        const after = data.after_photos || [];

        const beforeBlock = document.getElementById('beforePhotosBlock');
        const afterBlock = document.getElementById('afterPhotosBlock');
        const beforeEmpty = document.getElementById('beforePhotosEmpty');
        const afterEmpty = document.getElementById('afterPhotosEmpty');

        if (beforeBlock) {
            beforeBlock.hidden = !before.length && !beforeEmpty;
            if (beforeEmpty) beforeEmpty.hidden = !!before.length;
            renderPhotoGrid('beforePhotosGrid', before);
        }
        if (afterBlock) {
            afterBlock.hidden = !after.length && !afterEmpty;
            if (afterEmpty) afterEmpty.hidden = !!after.length;
            renderPhotoGrid('afterPhotosGrid', after);
        }

        const hasAny = before.length || after.length;
        section.hidden = !hasAny && !document.getElementById('addAfterPhotos');

        const addAfter = document.getElementById('addAfterPhotos');
        if (addAfter) {
            addAfter.hidden = false;
        }
    }

    function initAfterPhotoUpload() {
        const input = document.getElementById('afterPhotoInput');
        const errorEl = document.getElementById('afterPhotoError');
        if (!input) return;

        const MAX_BYTES = 5 * 1024 * 1024;
        const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

        function showError(message) {
            if (errorEl) {
                errorEl.textContent = message;
                errorEl.hidden = false;
            }
        }

        input.addEventListener('change', function () {
            if (errorEl) errorEl.hidden = true;
            const files = input.files;
            if (!files || !files.length) return;

            const bookingId = getQueryParams().bookingId;
            if (!bookingId) return;

            const api = getApi();
            if (!api) return;

            var uploads = [];
            for (var i = 0; i < files.length; i++) {
                var file = files[i];
                if (!ALLOWED.includes(file.type)) {
                    showError('Only JPG, PNG, and WEBP images are allowed.');
                    continue;
                }
                if (file.size > MAX_BYTES) {
                    showError('Each photo must be 5 MB or smaller.');
                    continue;
                }
                var formData = new FormData();
                formData.append('photo_type', 'after');
                formData.append('file', file, file.name);
                uploads.push(
                    api.apiFetch('/api/worker/bookings/' + encodeURIComponent(String(bookingId)) + '/photos', {
                        method: 'POST',
                        body: formData,
                    }).then(function (response) {
                        if (response.status === 401) {
                            redirectToLogin();
                            return null;
                        }
                        if (!response.ok) {
                            showError('Some photos could not be uploaded. Please try again.');
                            return null;
                        }
                        return response.json();
                    })
                );
            }

            Promise.all(uploads).then(function () {
                input.value = '';
                loadBooking();
            });
        });
    }

    function renderBooking(data, mode) {
        document.getElementById('pageTitle').textContent = mode === 'received' ? 'Job Details' : 'Hired Worker Details';
        document.getElementById('bookingId').textContent = 'Booking #' + data.id;

        const statusEl = document.getElementById('bookingStatus');
        statusEl.textContent = data.status || '--';
        statusEl.className = 'detail-status ' + getStatusClass(data.status);

        document.getElementById('serviceName').textContent = data.package_name || data.service_name || '--';

        const badge = document.getElementById('bookingTypeBadge');
        if (badge) {
            let typeLabel = 'INDIVIDUAL';
            let typeClass = 'type-badge--individual';
            if (data.package_id) {
                if (data.package_type === 'team') {
                    typeLabel = 'TEAM PACKAGE';
                    typeClass = 'type-badge--team';
                } else if (data.package_type === 'multitasking') {
                    typeLabel = 'MULTITASKING PACKAGE';
                    typeClass = 'type-badge--multitasking';
                } else {
                    typeLabel = 'PACKAGE';
                    typeClass = 'type-badge--package';
                }
            }
            badge.className = 'type-badge ' + typeClass;
            badge.textContent = typeLabel;
        }

        document.getElementById('bookingAmount').textContent = formatCurrency(data.amount);
        document.getElementById('bookingDate').textContent = formatDate(data.booking_date);
        document.getElementById('bookingTime').textContent = formatTime(data.booking_time);
        document.getElementById('bookingAddress').textContent = data.address || '--';

        const descSection = document.getElementById('descriptionSection');
        const descEl = document.getElementById('bookingDescription');
        if (data.description) {
            descEl.textContent = data.description;
            descSection.hidden = false;
        } else {
            descSection.hidden = true;
        }

        renderStatusTimeline(data.status);
        renderPackageServices(data.package_services);

        if (mode === 'sent') {
            renderTeamMembers(data.team_members);
        } else {
            renderTeamMembers([]);
        }

        renderStatusActions(data.status, mode);
        renderContactCard(data, mode);
        renderJobPhotos(data);
        showDetails();
    }

    function renderStatusActions(status, mode) {
        const actionsEl = document.getElementById('statusActions');
        if (!actionsEl) return;

        if (mode !== 'received') {
            actionsEl.hidden = true;
            return;
        }

        const key = String(status || '').toLowerCase();
        let html = '';

        if (key === 'accepted' || key === 'confirmed') {
            html = '<button type="button" class="status-action-btn status-action-btn--start" data-status-action="in_progress">Start Job</button>';
        } else if (key === 'in_progress') {
            html = '<button type="button" class="status-action-btn status-action-btn--complete" data-status-action="completion_requested">Request Completion</button>';
        }

        actionsEl.hidden = !html;
        actionsEl.innerHTML = html;
    }

    function initStatusActions() {
        const actionsEl = document.getElementById('statusActions');
        if (!actionsEl) return;

        actionsEl.addEventListener('click', function (event) {
            const btn = event.target.closest('[data-status-action]');
            if (!btn || !actionsEl.contains(btn)) return;

            const params = getQueryParams();
            if (!params.bookingId) return;

            const api = getApi();
            if (!api) return;

            const newStatus = btn.getAttribute('data-status-action');
            const endpoint = '/api/worker/bookings/' + encodeURIComponent(String(params.bookingId)) + '/status?new_status=' + encodeURIComponent(newStatus);

            btn.disabled = true;
            btn.textContent += '...';

            api.apiFetch(endpoint, { method: 'PUT' }).then(function (response) {
                if (response.status === 401) {
                    redirectToLogin();
                    return;
                }
                if (!response.ok) {
                    btn.disabled = false;
                    btn.textContent = newStatus === 'in_progress' ? 'Start Job' : 'Request Completion';
                    showError('Unable to update booking status. Please try again.');
                    return;
                }
                loadBooking();
            }).catch(function () {
                btn.disabled = false;
                btn.textContent = newStatus === 'in_progress' ? 'Start Job' : 'Request Completion';
                showError('Unable to connect to HandyHire. Please try again.');
            });
        });
    }

    async function loadBooking() {
        const api = getApi();
        if (!api) {
            showError('Booking service is unavailable right now. Please try again later.');
            return;
        }

        const params = getQueryParams();
        if (!params.bookingId || !params.mode) {
            showInvalidMode();
            return;
        }

        const bookingId = params.bookingId;
        const mode = params.mode;
        const endpoint = mode === 'received'
            ? '/api/worker/bookings/' + encodeURIComponent(String(bookingId))
            : '/api/worker/bookings/sent/' + encodeURIComponent(String(bookingId));

        showLoading();

        try {
            const response = await api.apiFetch(endpoint);

            if (response.status === 401) {
                redirectToLogin();
                return;
            }

            if (response.status === 403 || response.status === 404) {
                showUnauthorized();
                return;
            }

            if (!response.ok) {
                showError('Unable to load booking details. Please try again.');
                return;
            }

            const data = await response.json();
            renderBooking(data, mode);
        } catch (e) {
            showError('Unable to connect to HandyHire. Please try again.');
        }
    }

    function init() {
        if (!(window.HandyHireAPI && window.HandyHireAPI.requireRole('worker'))) return;
        initStatusActions();
        initAfterPhotoUpload();
        loadBooking();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
