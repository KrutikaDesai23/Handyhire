/* =========================================================
   HandyHire - Customer Booking Details JavaScript
   ========================================================= */

(function () {
    'use strict';

    const STATUS_FLOW = [
        { key: 'pending', label: 'Requested' },
        { key: 'accepted', label: 'Accepted' },
        { key: 'confirmed', label: 'Accepted' },
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
            sessionStorage.setItem('handyhire.customer.previousPage', 'booking-details.html');
        } catch (e) {}
        window.location.href = 'login.html';
    }

    function getBookingId() {
        const params = new URLSearchParams(window.location.search);
        const raw = params.get('booking_id');
        if (!raw) return null;
        const id = parseInt(raw, 10);
        return Number.isFinite(id) && id > 0 ? id : null;
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
        hide('bookingDetails');
        show('loadingState');
    }

    function showError(message) {
        hide('loadingState');
        hide('unauthorizedState');
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
        hide('bookingDetails');
        show('unauthorizedState');
    }

    function showDetails() {
        hide('loadingState');
        hide('errorState');
        hide('unauthorizedState');
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
            const leaderTag = member.is_leader ? ' <span style="font-size:11px;font-weight:700;color:var(--color-primary);">(Leader)</span>' : '';
            return '<li>' + escapeHtml(member.full_name) + leaderTag + ' <span style="color:var(--color-text-muted);font-weight:500;">- ' + escapeHtml(member.status) + '</span></li>';
        }).join('');
    }

    function renderBooking(data) {
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
        renderTeamMembers(data.team_members);

        const activeStatuses = ['accepted', 'confirmed', 'completion_requested'];
        const hasPhone = activeStatuses.includes(String(data.status || '').toLowerCase());
        const phone = data.worker_phone || data.customer_phone || null;
        const normalized = normalizePhone(phone);

        const contactNameEl = document.getElementById('providerName');
        const contactImageEl = document.getElementById('contactImage');
        const contactInitialEl = document.getElementById('contactInitial');
        const contactNoteEl = document.getElementById('contactAvailability');
        const callBtn = document.getElementById('callButton');
        const waBtn = document.getElementById('whatsappButton');
        const mapsBtn = document.getElementById('mapsButton');

        if (contactNameEl) contactNameEl.textContent = data.worker_name || '--';

        const avatarSrc = data.worker_image || data.customer_image || null;
        if (avatarSrc) {
            contactImageEl.src = avatarSrc;
            contactImageEl.hidden = false;
            contactInitialEl.hidden = true;
        } else {
            contactImageEl.hidden = true;
            contactInitialEl.hidden = false;
            const name = data.worker_name || data.customer_name || '?';
            contactInitialEl.textContent = name.charAt(0).toUpperCase();
        }

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

        showDetails();
    }

    async function loadBooking() {
        const api = getApi();
        if (!api) {
            showError('Booking service is unavailable right now. Please try again later.');
            return;
        }

        const bookingId = getBookingId();
        if (!bookingId) {
            showError('Invalid booking ID.');
            return;
        }

        showLoading();

        try {
            const response = await api.apiFetch('/api/bookings/customer/bookings/' + encodeURIComponent(String(bookingId)));

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
            renderBooking(data);
        } catch (e) {
            showError('Unable to connect to HandyHire. Please try again.');
        }
    }

    function init() {
        if (!(window.HandyHireAPI && window.HandyHireAPI.requireRole('customer'))) return;
        loadBooking();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
