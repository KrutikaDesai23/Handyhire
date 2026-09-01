/* =========================================================
   HandyHire - Activity / Booking History JavaScript
   Fetches the authenticated customer's real bookings from
   the FastAPI backend (GET /api/bookings/customer/bookings)
   and renders them grouped by Today / Yesterday / Earlier.
   Completed bookings expose a Leave Review flow backed by
   POST /api/reviews. PostgreSQL is the source of truth.
   ========================================================= */

(function () {
    'use strict';

    const SECTION_TITLES = {
        today:     'Today',
        yesterday: 'Yesterday',
        older:     'Earlier',
    };

    const STATUS_MAP = {
        pending:   { label: 'Pending',   css: 'booking-status--pending' },
        accepted:  { label: 'Accepted',  css: 'booking-status--confirmed' },
        confirmed: { label: 'Confirmed', css: 'booking-status--confirmed' },
        rejected:  { label: 'Rejected',  css: 'booking-status--cancelled' },
        cancelled: { label: 'Cancelled', css: 'booking-status--cancelled' },
        completed: { label: 'Completed', css: 'booking-status--completed' },
        completion_requested: { label: 'Awaiting confirmation', css: 'booking-status--pending' },
    };

    const ACTIONS = {
        completion_requested: [
            ['confirm_completion', 'Confirm Completion', 'booking-action-btn--accept'],
            ['reject_completion', 'Work Not Completed', 'booking-action-btn--reject']
        ]
    };

    const ACTION_STATUS = {
        confirm_completion: 'completed',
        reject_completion: 'accepted'
    };

    let currentBookings = [];
    let reviewedBookingIds = new Set();
    let currentReviewBookingId = null;
    let selectedRating = 0;

    function buildStars(rating) {
        const full = Math.max(0, Math.min(5, Math.floor(rating)));
        const empty = 5 - full;
        return '\u2605'.repeat(full) + '\u2606'.repeat(empty);
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

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
            sessionStorage.setItem('handyhire.customer.previousPage', 'activity.html');
        } catch (e) {}
        window.location.href = 'login.html';
    }

    function parseDate(value) {
        if (value instanceof Date) return value;
        const text = String(value || '').trim();
        if (!text) return null;
        const parts = text.split('-').map(Number);
        if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
            return new Date(parts[0], parts[1] - 1, parts[2]);
        }
        const d = new Date(text);
        return isNaN(d.getTime()) ? null : d;
    }

    function isSameDay(a, b) {
        return a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate();
    }

    function groupFor(date) {
        if (!date) return 'older';
        const now = new Date();
        if (isSameDay(date, now)) return 'today';
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        if (isSameDay(date, yesterday)) return 'yesterday';
        return 'older';
    }

    function formatDate(date) {
        if (!date) return '--';
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const group = groupFor(date);
        const dayNum = date.getDate();
        const month = months[date.getMonth()];
        if (group === 'today') return 'Today, ' + dayNum + ' ' + month;
        if (group === 'yesterday') return 'Yesterday, ' + dayNum + ' ' + month;
        return dayNum + ' ' + month + ' ' + date.getFullYear();
    }

    function formatTime(time) {
        const text = String(time || '').trim();
        if (!text) return '--';
        return text;
    }

    function mapBooking(b) {
        const statusKey = String(b.status || 'pending').toLowerCase();
        const status = STATUS_MAP[statusKey] || { label: escapeHtml(b.status || '--'), css: 'booking-status--pending' };
        const date = parseDate(b.booking_date);
        var name = b.worker_name || '--';
        var occupation = b.service_name || '--';

        if (b.package_id && b.package_name) {
            name = b.package_name;
            if (b.package_type === 'team') {
                occupation = 'TEAM PACKAGE';
            } else if (b.package_type === 'multitasking') {
                occupation = 'MULTITASKING PACKAGE';
            } else {
                occupation = 'Package';
            }
        }

        return {
            id: b.id,
            name: name,
            occupation: occupation,
            status: status.label,
            statusCss: status.css,
            statusKey: statusKey,
            date: formatDate(date),
            time: formatTime(b.booking_time),
            group: groupFor(date),
            amount: typeof b.amount === 'number' ? b.amount : null,
            address: b.address || '--',
            worker_id: b.worker_id || null,
            package_type: b.package_type || null,
        };
    }

    function renderCard(b) {
        const ratingRow = (b.rating != null)
            ? `<div class="booking-rating" aria-label="Rated ${Number(b.rating).toFixed(1)} out of 5">
                    <span class="stars" aria-hidden="true">${buildStars(Number(b.rating))}</span>
                    <span class="rating-value">${Number(b.rating).toFixed(1)}</span>
                </div>`
            : '';

        const metaRow = `
            <div class="booking-meta">
                <span><span class="meta-label">Date:</span><span class="meta-value">${escapeHtml(b.date)}</span></span>
                <span><span class="meta-label">Time:</span><span class="meta-value">${escapeHtml(b.time)}</span></span>
            </div>`;

        const isCompleted = b.statusKey === 'completed';
        const alreadyReviewed = reviewedBookingIds.has(b.id);
        const reviewButtonHtml = isCompleted && !alreadyReviewed
            ? `<div class="booking-review-row"><button type="button" class="review-btn" data-booking-id="${escapeHtml(String(b.id))}">Leave Review</button></div>`
            : isCompleted && alreadyReviewed
                ? `<div class="booking-review-row"><span class="reviewed-badge" aria-label="Reviewed">&#10003; Reviewed</span></div>`
                : '';

        const actions = ACTIONS[b.statusKey] || [];
        const actionsHtml = actions.length
            ? `<div class="booking-actions">` + actions.map(function (action) {
                return `<button type="button" class="booking-action-btn ${escapeHtml(action[2])}" data-action="${escapeHtml(action[0])}" data-id="${escapeHtml(String(b.id))}">${escapeHtml(action[1])}</button>`;
            }).join('') + `</div>`
            : '';

        return `
            <article class="booking-card" tabindex="0"
                     data-booking-id="${escapeHtml(b.id)}"
                     aria-label="Booking ${escapeHtml(b.id)} with ${escapeHtml(b.name)}, ${escapeHtml(b.occupation)}, ${escapeHtml(b.status)} on ${escapeHtml(b.date)} at ${escapeHtml(b.time)}">
                <div class="booking-top">
                    <div>
                        <p class="booking-name">${escapeHtml(b.name)}</p>
                        <p class="booking-occupation">${escapeHtml(b.occupation)}</p>
                    </div>
                    <span class="${b.statusCss}">${escapeHtml(b.status)}</span>
                </div>
                ${ratingRow}
                ${metaRow}
                ${actionsHtml}
                ${reviewButtonHtml}
            </article>
        `.trim();
    }

    function renderSection(groupKey, items) {
        if (!items.length) return '';
        const title = SECTION_TITLES[groupKey] || '';
        const idSafe = groupKey.replace(/[^a-z0-9]/gi, '-');
        const cards = items.map(renderCard).join('');
        return `
            <section class="section-group" aria-labelledby="group-${idSafe}">
                <h2 class="section-title" id="group-${idSafe}">${title}</h2>
                ${cards}
            </section>
        `.trim();
    }

    function renderFeed(bookings, container, emptyState) {
        const groups = { today: [], yesterday: [], older: [] };
        bookings.forEach((b) => {
            if (groups[b.group]) groups[b.group].push(b);
        });

        const html = ['today', 'yesterday', 'older']
            .map((key) => renderSection(key, groups[key]))
            .filter(Boolean)
            .join('');

        container.innerHTML = html;
        if (emptyState) emptyState.hidden = Boolean(html);
    }

    function filterBookings(bookings, query) {
        const q = String(query || '').trim().toLowerCase();
        if (!q) return bookings.slice();

        return bookings.filter((b) => {
            const amount = b.amount != null ? String(b.amount) : '';
            return (
                b.name.toLowerCase().includes(q) ||
                b.occupation.toLowerCase().includes(q) ||
                b.status.toLowerCase().includes(q) ||
                b.date.toLowerCase().includes(q) ||
                b.time.toLowerCase().includes(q) ||
                b.address.toLowerCase().includes(q) ||
                amount.includes(q)
            );
        });
    }

    function initSearch() {
        const input = document.getElementById('activitySearch');
        if (!input) return;

        input.addEventListener('input', function () {
            const feed = document.getElementById('activityFeed');
            const emptyState = document.getElementById('emptyState');
            if (!feed) return;

            const filtered = filterBookings(currentBookings, input.value);
            renderFeed(filtered, feed, emptyState);
            if (emptyState && !filtered.length && currentBookings.length) {
                emptyState.textContent = 'No bookings match your search.';
                emptyState.hidden = false;
            }
        });
    }

    function showLoading(container, emptyState) {
        container.innerHTML = '';
        if (emptyState) {
            emptyState.textContent = 'Loading your bookings...';
            emptyState.hidden = false;
        }
    }

    function showError(container, emptyState, message) {
        container.innerHTML = '';
        if (emptyState) {
            emptyState.textContent = message;
            emptyState.hidden = false;
        }
    }

    function showEmpty(emptyState) {
        if (emptyState) {
            emptyState.textContent = 'No bookings yet. When you book a professional, your history will appear here.';
            emptyState.hidden = false;
        }
    }

    function loadBookings(container, emptyState) {
        const api = getApi();
        if (!api) {
            showError(container, emptyState, 'Booking service is unavailable right now. Please try again later.');
            return;
        }

        showLoading(container, emptyState);

        api.apiFetch('/api/bookings/customer/bookings')
            .then(function (response) {
                if (response.status === 401) {
                    redirectToLogin();
                    return null;
                }
                if (response.status === 403) {
                    showError(container, emptyState, 'You are not allowed to view these bookings.');
                    return null;
                }
                if (response.status === 404) {
                    showError(container, emptyState, 'Your bookings could not be found.');
                    return null;
                }
                if (!response.ok) {
                    showError(container, emptyState, 'Unable to load your bookings. Please try again.');
                    return null;
                }
                return response.json();
            })
            .then(function (data) {
                if (!data) return;

                const bookings = (Array.isArray(data) ? data : []).map(mapBooking);
                currentBookings = bookings;
                if (!bookings.length) {
                    container.innerHTML = '';
                    showEmpty(emptyState);
                    return;
                }

                renderFeed(bookings, container, emptyState);
                initSearch();
            })
            .catch(function () {
                showError(container, emptyState, 'Unable to connect to HandyHire. Please try again.');
            });
    }

    // ===================== CUSTOMER ACTIONS =====================

    async function updateCustomerBookingStatus(bookingId, newStatus) {
        const api = getApi();
        if (!api) return;

        const endpoint = '/api/customer/bookings/' + encodeURIComponent(String(bookingId)) + '/' + encodeURIComponent(newStatus);

        try {
            const response = await api.apiFetch(endpoint, { method: 'PUT' });

            if (response.status === 401) {
                api.clearAuth();
                window.location.href = 'login.html';
                return;
            }

            if (response.status === 403) {
                alert('You are not allowed to update this booking.');
                return;
            }

            if (!response.ok) {
                const err = await response.json().catch(function () { return {}; });
                alert((err && err.detail) ? err.detail : 'Unable to update this booking.');
                return;
            }

            const updated = await response.json();
            const index = currentBookings.findIndex(function (b) { return String(b.id) === String(updated.id); });
            if (index >= 0) {
                currentBookings[index] = mapBooking(updated);
            }
            renderFeed(currentBookings, document.getElementById('activityFeed'), document.getElementById('emptyState'));
        } catch (error) {
            alert('Unable to connect to HandyHire.');
        }
    }

    // ===================== REVIEW MODAL =====================

    function openReviewModal(bookingId) {
        currentReviewBookingId = bookingId;
        selectedRating = 0;
        updateStarDisplay();

        const commentEl = document.getElementById('reviewComment');
        if (commentEl) commentEl.value = '';

        const errorEl = document.getElementById('reviewError');
        if (errorEl) { errorEl.hidden = true; errorEl.textContent = ''; }

        const ratingError = document.getElementById('reviewRatingError');
        if (ratingError) ratingError.hidden = true;

        const overlay = document.getElementById('reviewModalOverlay');
        if (overlay) {
            overlay.hidden = false;
            overlay.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }

        const firstStar = document.querySelector('#starRating .star');
        if (firstStar) firstStar.focus();
    }

    function closeReviewModal() {
        currentReviewBookingId = null;
        selectedRating = 0;
        updateStarDisplay();

        const commentEl = document.getElementById('reviewComment');
        if (commentEl) commentEl.value = '';

        const errorEl = document.getElementById('reviewError');
        if (errorEl) { errorEl.hidden = true; errorEl.textContent = ''; }

        const ratingError = document.getElementById('reviewRatingError');
        if (ratingError) ratingError.hidden = true;

        const overlay = document.getElementById('reviewModalOverlay');
        if (overlay) {
            overlay.hidden = true;
            overlay.style.display = 'none';
            document.body.style.overflow = '';
        }
    }

    function updateStarDisplay() {
        const stars = document.querySelectorAll('#starRating .star');
        stars.forEach(function (star) {
            const value = Number(star.dataset.value);
            star.classList.toggle('selected', value <= selectedRating);
            star.classList.toggle('hovered', false);
            star.setAttribute('aria-checked', value === selectedRating ? 'true' : 'false');
        });
    }

    function setRating(value) {
        selectedRating = value;
        updateStarDisplay();

        const ratingError = document.getElementById('reviewRatingError');
        if (ratingError) ratingError.hidden = true;
    }

    function initStarRating() {
        const container = document.getElementById('starRating');
        if (!container) return;

        const stars = container.querySelectorAll('.star');

        stars.forEach(function (star) {
            star.addEventListener('click', function () {
                setRating(Number(star.dataset.value));
            });

            star.addEventListener('mouseenter', function () {
                const value = Number(star.dataset.value);
                stars.forEach(function (s) {
                    s.classList.toggle('hovered', Number(s.dataset.value) <= value);
                });
            });

            star.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setRating(Number(star.dataset.value));
                }
            });
        });

        container.addEventListener('mouseleave', function () {
            stars.forEach(function (s) { s.classList.remove('hovered'); });
        });
    }

    function showReviewError(message) {
        const el = document.getElementById('reviewError');
        if (!el) return;
        el.textContent = message;
        el.hidden = false;
    }

    function hideReviewError() {
        const el = document.getElementById('reviewError');
        if (el) { el.hidden = true; el.textContent = ''; }
    }

    function submitReview() {
        if (!currentReviewBookingId) return;

        if (!selectedRating || selectedRating < 1 || selectedRating > 5) {
            const ratingError = document.getElementById('reviewRatingError');
            if (ratingError) ratingError.hidden = false;
            return;
        }

        hideReviewError();

        const api = getApi();
        const submitBtn = document.getElementById('submitReviewBtn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
        }

        const commentEl = document.getElementById('reviewComment');
        const comment = commentEl ? commentEl.value.trim() : '';

        const payload = {
            booking_id: Number(currentReviewBookingId),
            rating: selectedRating,
            comment: comment || null,
        };

        api.apiFetch('/api/reviews', {
            method: 'POST',
            body: JSON.stringify(payload),
        }).then(function (response) {
            if (response.status === 401) {
                api.clearAuth();
                window.location.href = 'login.html';
                return;
            }
            if (response.status === 403) {
                throw new Error('You are not authorized to review this booking.');
            }
            if (!response.ok) {
                return response.json().then(function (err) {
                    const detail = (err && err.detail) ? err.detail : 'Unable to submit review.';
                    if (response.status === 400 && detail.toLowerCase().includes('already')) {
                        throw new Error('You have already reviewed this booking.');
                    }
                    if (response.status === 400 && detail.toLowerCase().includes('completed')) {
                        throw new Error('Only completed bookings can be reviewed.');
                    }
                    throw new Error(detail);
                }).catch(function () {
                    throw new Error('Unable to submit review. Please try again.');
                });
            }
            return response.json();
        }).then(function (review) {
            if (!review) return;
            reviewedBookingIds.add(currentReviewBookingId);
            closeReviewModal();
            const feed = document.getElementById('activityFeed');
            const emptyState = document.getElementById('emptyState');
            if (feed) loadBookings(feed, emptyState);
        }).catch(function (err) {
            showReviewError(err && err.message ? err.message : 'Unable to submit review. Please try again.');
        }).finally(function () {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Review';
            }
        });
    }

    function initReviewModal() {
        const overlay = document.getElementById('reviewModalOverlay');
        if (!overlay) return;

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeReviewModal();
        });

        const cancelBtn = document.getElementById('cancelReviewBtn');
        if (cancelBtn) cancelBtn.addEventListener('click', closeReviewModal);

        const submitBtn = document.getElementById('submitReviewBtn');
        if (submitBtn) submitBtn.addEventListener('click', submitReview);

        initStarRating();

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !overlay.hidden) {
                closeReviewModal();
            }
        });
    }

    // ===================== REVIEW BUTTON DELEGATION =====================

    function initReviewButtons() {
        const feed = document.getElementById('activityFeed');
        if (!feed) return;

        feed.addEventListener('click', function (e) {
            const btn = e.target.closest('.review-btn');
            if (!btn) return;
            const bookingId = btn.dataset.bookingId;
            if (bookingId) openReviewModal(bookingId);
        });
    }

    function initCustomerActions() {
        const feed = document.getElementById('activityFeed');
        if (!feed) return;

        feed.addEventListener('click', function (e) {
            const button = e.target.closest('[data-action]');
            if (!button || !feed.contains(button)) return;

            const action = button.dataset.action;
            const bookingId = button.dataset.id;
            if (!action || !bookingId) return;

            const nextStatus = ACTION_STATUS[action];
            if (!nextStatus) return;

            button.disabled = true;
            button.textContent += '...';

            updateCustomerBookingStatus(bookingId, nextStatus);
        });
    }

    // ===================== INIT =====================

    function init() {
        const feed = document.getElementById('activityFeed');
        const emptyState = document.getElementById('emptyState');
        if (!feed) return;

        // Central role guard: customers only. A worker token is
        // redirected to provider-home.html by requireRole() itself.
        if (!(window.HandyHireAPI && window.HandyHireAPI.requireRole('customer'))) return;

        initReviewModal();
        initReviewButtons();
        initCustomerActions();
        initSearch();
        loadBookings(feed, emptyState);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
