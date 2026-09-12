/* =========================================================
   HandyHire - Customer Activity
   Uses the provider Activity DOM/card language while keeping
   customer endpoints, completion actions and review flow.
   ========================================================= */

(function () {
    'use strict';

    const GROUP_TITLES = {
        today: 'Today',
        yesterday: 'Yesterday',
        older: 'Earlier'
    };

    const STATUSES = {
        pending: ['Pending', 'booking-status--pending'],
        accepted: ['Accepted', 'booking-status--confirmed'],
        confirmed: ['Confirmed', 'booking-status--confirmed'],
        in_progress: ['In Progress', 'booking-status--in-progress'],
        rejected: ['Rejected', 'booking-status--cancelled'],
        declined: ['Declined', 'booking-status--cancelled'],
        cancelled: ['Cancelled', 'booking-status--cancelled'],
        completed: ['Completed', 'booking-status--completed'],
        completion_requested: ['Awaiting confirmation', 'booking-status--pending']
    };

    const ACTIONS = {
        completion_requested: [
            ['confirm_completion', 'Confirm Completion', 'booking-action-btn--accept'],
            ['reject_completion', 'Work Not Completed', 'booking-action-btn--reject']
        ]
    };

    const ACTION_STATUS = {
        confirm_completion: 'confirm-completion',
        reject_completion: 'reject-completion'
    };

    let activeMode = 'all';
    let currentBookings = [];
    let reviewedBookingIds = new Set();
    let currentReviewBookingId = null;
    let selectedRating = 0;

    function getApi() {
        const api = window.HandyHireAPI;
        return api && typeof api.apiFetch === 'function' ? api : null;
    }

    function redirectToLogin() {
        try {
            sessionStorage.setItem('handyhire.customer.previousPage', 'activity.html');
        } catch (error) {}
        window.location.href = 'login.html';
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function parseDate(value) {
        if (!value) return null;
        if (value instanceof Date) return value;

        const parts = String(value).split('-').map(Number);
        if (parts.length === 3 && parts.every(Number.isFinite)) {
            return new Date(parts[0], parts[1] - 1, parts[2]);
        }

        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date;
    }

    function sameDay(first, second) {
        return first.getFullYear() === second.getFullYear() &&
            first.getMonth() === second.getMonth() &&
            first.getDate() === second.getDate();
    }

    function getGroup(date) {
        if (!date) return 'older';

        const today = new Date();
        if (sameDay(date, today)) return 'today';

        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        return sameDay(date, yesterday) ? 'yesterday' : 'older';
    }

    function formatDate(date) {
        if (!date) return '--';

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        if (sameDay(date, today)) {
            return 'Today, ' + date.getDate() + ' ' + months[date.getMonth()];
        }
        if (sameDay(date, yesterday)) {
            return 'Yesterday, ' + date.getDate() + ' ' + months[date.getMonth()];
        }
        return date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
    }

    function formatTime(value) {
        const text = String(value || '').trim();
        const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
        if (!match) return text || '--';

        let hour = parseInt(match[1], 10);
        const suffix = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12 || 12;
        return hour + ':' + match[2] + ' ' + suffix;
    }

    function formatPrice(value) {
        const amount = Number(value);
        return Number.isFinite(amount) ? '\u20B9' + amount.toLocaleString('en-IN') : '--';
    }

    function getPackageTypeLabel(booking) {
        if (!booking.packageId) return 'INDIVIDUAL BOOKING';
        if (booking.packageType === 'team') return 'TEAM PACKAGE';
        if (booking.packageType === 'multitasking') return 'MULTITASKING PACKAGE';
        return 'PACKAGE BOOKING';
    }

    function mapBooking(booking) {
        const statusKey = String(booking.status || 'pending').toLowerCase();
        const status = STATUSES[statusKey] || [booking.status || 'Pending', 'booking-status--pending'];
        const date = parseDate(booking.booking_date);
        const packageId = booking.package_id || null;
        const packageType = booking.package_type || null;
        const packageName = booking.package_name || null;
        const isPackage = Boolean(packageId);

        let name = booking.worker_name || '--';
        let occupation = booking.service_name || 'Professional service';
        let personLabel = 'Professional';

        if (isPackage) {
            name = packageName || 'Service Package';
            occupation = packageType === 'team'
                ? 'Team Package'
                : packageType === 'multitasking'
                    ? 'Multitasking Package'
                    : 'Package Booking';
            personLabel = 'Package';
        }

        return {
            id: booking.id,
            name: name,
            occupation: occupation,
            personLabel: personLabel,
            bookingType: isPackage ? 'package' : 'individual',
            packageId: packageId,
            packageType: packageType,
            packageName: packageName,
            statusKey: statusKey,
            status: status[0],
            statusCss: status[1],
            date: formatDate(date),
            time: formatTime(booking.booking_time),
            group: getGroup(date),
            amount: booking.amount,
            address: booking.address || '--',
            description: booking.description || '',
            workerId: booking.worker_id || null
        };
    }

    function renderActions(booking) {
        const actions = ACTIONS[booking.statusKey];
        if (!actions) return '';

        return '<div class="booking-actions">' + actions.map(function (action) {
            return '<button type="button" class="booking-action-btn ' + escapeHtml(action[2]) + '" ' +
                'data-action="' + escapeHtml(action[0]) + '" data-id="' + escapeHtml(booking.id) + '">' +
                escapeHtml(action[1]) + '</button>';
        }).join('') + '</div>';
    }

    function renderReview(booking) {
        if (booking.statusKey !== 'completed') return '';

        if (reviewedBookingIds.has(booking.id)) {
            return '<div class="booking-actions"><span class="booking-status booking-status--confirmed">Reviewed</span></div>';
        }

        return '<div class="booking-actions">' +
            '<button type="button" class="booking-action-btn booking-action-btn--accept review-btn" ' +
            'data-booking-id="' + escapeHtml(booking.id) + '">Leave Review</button>' +
            '</div>';
    }

    function renderCard(booking) {
        const typeLabel = getPackageTypeLabel(booking);
        const description = booking.description
            ? '<p class="booking-description">' + escapeHtml(booking.description) + '</p>'
            : '';

        return `
            <article
                class="booking-card"
                tabindex="0"
                role="button"
                data-booking-id="${escapeHtml(booking.id)}"
            >
                <p class="booking-direction">
                    ${escapeHtml(booking.personLabel)}
                </p>

                <div class="booking-top">
                    <div>
                        <p class="booking-name">${escapeHtml(booking.name)}</p>
                        <p class="booking-occupation">${escapeHtml(booking.occupation)}</p>
                    </div>

                    <div class="booking-badges">
                        <span class="booking-type-badge booking-type-badge--${escapeHtml(booking.bookingType)}">
                            ${escapeHtml(typeLabel)}
                        </span>
                        <span class="booking-status ${escapeHtml(booking.statusCss)}">
                            ${escapeHtml(booking.status)}
                        </span>
                    </div>
                </div>

                <div class="booking-meta">
                    <span>
                        <span class="meta-label">Date:</span>
                        <span class="meta-value">${escapeHtml(booking.date)}</span>
                    </span>
                    <span>
                        <span class="meta-label">Time:</span>
                        <span class="meta-value">${escapeHtml(booking.time)}</span>
                    </span>
                </div>

                <div class="booking-meta">
                    <span>
                        <span class="meta-label">Amount:</span>
                        <span class="meta-value">${escapeHtml(formatPrice(booking.amount))}</span>
                    </span>
                </div>

                ${description}
                ${renderActions(booking)}
                ${renderReview(booking)}
            </article>
        `.trim();
    }

    function renderSection(group, bookings) {
        if (!bookings.length) return '';
        return `
            <section class="section-group">
                <h2 class="section-title">${GROUP_TITLES[group]}</h2>
                ${bookings.map(renderCard).join('')}
            </section>
        `.trim();
    }

    function renderFeed(bookings, container, emptyState) {
        const groups = { today: [], yesterday: [], older: [] };
        bookings.forEach(function (booking) {
            if (groups[booking.group]) groups[booking.group].push(booking);
        });

        const html = ['today', 'yesterday', 'older']
            .map(function (group) { return renderSection(group, groups[group]); })
            .filter(Boolean)
            .join('');

        container.innerHTML = html;
        if (emptyState) emptyState.hidden = Boolean(html);
    }

    function matchesSearch(booking, query) {
        if (!query) return true;
        const amount = booking.amount != null ? String(booking.amount) : '';
        return booking.name.toLowerCase().includes(query) ||
            booking.occupation.toLowerCase().includes(query) ||
            booking.status.toLowerCase().includes(query) ||
            booking.date.toLowerCase().includes(query) ||
            booking.time.toLowerCase().includes(query) ||
            booking.address.toLowerCase().includes(query) ||
            amount.includes(query);
    }

    function getVisibleBookings() {
        const input = document.getElementById('activitySearch');
        const query = input ? String(input.value || '').trim().toLowerCase() : '';

        return currentBookings.filter(function (booking) {
            const modeMatch = activeMode === 'completed'
                ? booking.statusKey === 'completed'
                : true;
            return modeMatch && matchesSearch(booking, query);
        });
    }

    function renderCurrent() {
        const feed = document.getElementById('activityFeed');
        const emptyState = document.getElementById('emptyState');
        if (!feed) return;

        const visible = getVisibleBookings();
        renderFeed(visible, feed, emptyState);

        if (emptyState && !visible.length && currentBookings.length) {
            emptyState.textContent = activeMode === 'completed'
                ? 'No completed bookings match this view.'
                : 'No bookings match your search.';
            emptyState.hidden = false;
        }
    }

    function initModeTabs() {
        const tabs = document.getElementById('activityModeTabs');
        if (!tabs) return;

        tabs.addEventListener('click', function (event) {
            const button = event.target.closest('[data-mode]');
            if (!button || !tabs.contains(button)) return;

            activeMode = button.dataset.mode === 'completed' ? 'completed' : 'all';

            tabs.querySelectorAll('[data-mode]').forEach(function (tab) {
                const selected = tab === button;
                tab.classList.toggle('is-active', selected);
                tab.setAttribute('aria-selected', selected ? 'true' : 'false');
            });

            const input = document.getElementById('activitySearch');
            if (input) {
                input.placeholder = activeMode === 'completed'
                    ? 'Search completed bookings'
                    : 'Search all bookings';
            }

            renderCurrent();
        });
    }

    function initSearch() {
        const input = document.getElementById('activitySearch');
        if (!input) return;
        input.addEventListener('input', renderCurrent);
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

                currentBookings = (Array.isArray(data) ? data : []).map(mapBooking);
                if (!currentBookings.length) {
                    container.innerHTML = '';
                    showEmpty(emptyState);
                    return;
                }

                renderCurrent();
            })
            .catch(function () {
                showError(container, emptyState, 'Unable to connect to HandyHire. Please try again.');
            });
    }

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
                const error = await response.json().catch(function () { return {}; });
                alert(error && error.detail ? error.detail : 'Unable to update this booking.');
                return;
            }

            const updated = await response.json();
            const index = currentBookings.findIndex(function (booking) {
                return String(booking.id) === String(updated.id);
            });
            if (index >= 0) currentBookings[index] = mapBooking(updated);
            renderCurrent();
        } catch (error) {
            alert('Unable to connect to HandyHire.');
        }
    }

    function openReviewModal(bookingId) {
        currentReviewBookingId = bookingId;
        selectedRating = 0;
        updateStarDisplay();

        const comment = document.getElementById('reviewComment');
        if (comment) comment.value = '';

        const error = document.getElementById('reviewError');
        if (error) { error.hidden = true; error.textContent = ''; }

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

        const comment = document.getElementById('reviewComment');
        if (comment) comment.value = '';

        const error = document.getElementById('reviewError');
        if (error) { error.hidden = true; error.textContent = ''; }

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
        document.querySelectorAll('#starRating .star').forEach(function (star) {
            const value = Number(star.dataset.value);
            star.classList.toggle('selected', value <= selectedRating);
            star.classList.remove('hovered');
            star.setAttribute('aria-checked', value === selectedRating ? 'true' : 'false');
        });
    }

    function setRating(value) {
        selectedRating = value;
        updateStarDisplay();
        const error = document.getElementById('reviewRatingError');
        if (error) error.hidden = true;
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
                stars.forEach(function (item) {
                    item.classList.toggle('hovered', Number(item.dataset.value) <= value);
                });
            });
            star.addEventListener('keydown', function (event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setRating(Number(star.dataset.value));
                }
            });
        });

        container.addEventListener('mouseleave', function () {
            stars.forEach(function (star) { star.classList.remove('hovered'); });
        });
    }

    function showReviewError(message) {
        const error = document.getElementById('reviewError');
        if (!error) return;
        error.textContent = message;
        error.hidden = false;
    }

    function hideReviewError() {
        const error = document.getElementById('reviewError');
        if (error) { error.hidden = true; error.textContent = ''; }
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
        if (!api) return;

        const submitButton = document.getElementById('submitReviewBtn');
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Submitting...';
        }

        const commentElement = document.getElementById('reviewComment');
        const comment = commentElement ? commentElement.value.trim() : '';

        api.apiFetch('/api/reviews', {
            method: 'POST',
            body: JSON.stringify({
                booking_id: Number(currentReviewBookingId),
                rating: selectedRating,
                comment: comment || null
            })
        })
            .then(function (response) {
                if (response.status === 401) {
                    api.clearAuth();
                    window.location.href = 'login.html';
                    return null;
                }
                if (response.status === 403) {
                    throw new Error('You are not authorized to review this booking.');
                }
                if (!response.ok) {
                    return response.json().then(function (error) {
                        const detail = error && error.detail ? String(error.detail) : 'Unable to submit review.';
                        if (response.status === 400 && detail.toLowerCase().includes('already')) {
                            throw new Error('You have already reviewed this booking.');
                        }
                        if (response.status === 400 && detail.toLowerCase().includes('completed')) {
                            throw new Error('Only completed bookings can be reviewed.');
                        }
                        throw new Error(detail);
                    });
                }
                return response.json();
            })
            .then(function (review) {
                if (!review) return;
                reviewedBookingIds.add(Number(currentReviewBookingId));
                reviewedBookingIds.add(String(currentReviewBookingId));
                closeReviewModal();
                renderCurrent();
            })
            .catch(function (error) {
                showReviewError(error && error.message ? error.message : 'Unable to submit review. Please try again.');
            })
            .finally(function () {
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = 'Submit Review';
                }
            });
    }

    function initReviewModal() {
        const overlay = document.getElementById('reviewModalOverlay');
        if (!overlay) return;

        overlay.addEventListener('click', function (event) {
            if (event.target === overlay) closeReviewModal();
        });

        const cancelButton = document.getElementById('cancelReviewBtn');
        if (cancelButton) cancelButton.addEventListener('click', closeReviewModal);

        const submitButton = document.getElementById('submitReviewBtn');
        if (submitButton) submitButton.addEventListener('click', submitReview);

        initStarRating();

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && !overlay.hidden) closeReviewModal();
        });
    }

    function initFeedActions() {
        const feed = document.getElementById('activityFeed');
        if (!feed) return;

        feed.addEventListener('click', function (event) {
            const reviewButton = event.target.closest('.review-btn');
            if (reviewButton && feed.contains(reviewButton)) {
                event.stopPropagation();
                const bookingId = reviewButton.dataset.bookingId;
                if (bookingId) openReviewModal(bookingId);
                return;
            }

            const actionButton = event.target.closest('[data-action]');
            if (actionButton && feed.contains(actionButton)) {
                event.stopPropagation();
                const action = actionButton.dataset.action;
                const bookingId = actionButton.dataset.id;
                const nextStatus = ACTION_STATUS[action];
                if (!bookingId || !nextStatus) return;
                actionButton.disabled = true;
                updateCustomerBookingStatus(bookingId, nextStatus);
                return;
            }

            const card = event.target.closest('.booking-card');
            if (!card || !feed.contains(card)) return;
            const bookingId = card.dataset.bookingId;
            if (bookingId) {
                window.location.href = 'booking-details.html?booking_id=' + encodeURIComponent(String(bookingId));
            }
        });

        feed.addEventListener('keydown', function (event) {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            if (event.target.closest('button') || event.target.closest('a')) return;
            const card = event.target.closest('.booking-card');
            if (!card || !feed.contains(card)) return;
            event.preventDefault();
            const bookingId = card.dataset.bookingId;
            if (bookingId) {
                window.location.href = 'booking-details.html?booking_id=' + encodeURIComponent(String(bookingId));
            }
        });
    }

    function init() {
        const feed = document.getElementById('activityFeed');
        const emptyState = document.getElementById('emptyState');
        if (!feed) return;

        if (!(window.HandyHireAPI && window.HandyHireAPI.requireRole('customer'))) return;

        initModeTabs();
        initSearch();
        initReviewModal();
        initFeedActions();
        loadBookings(feed, emptyState);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
