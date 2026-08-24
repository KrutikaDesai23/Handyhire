/* =========================================================
   HandyHire - Provider Person Details JavaScript
   Loads the REAL worker from GET /api/workers/{worker_id}
   (and reviews from GET /api/reviews/workers/{worker_id}).
   The old WORKER_CATALOG is no longer used as the normal
   data source. Falls back to neutral "--" placeholders for
   fields the public endpoint does not expose.
   ========================================================= */

(function () {
    'use strict';

    /**
     * Require an authenticated provider session.
     * @returns {boolean}
     */
    function requireAuth() {
        if (!window.HandyHireAPI || !window.HandyHireAPI.isLoggedIn()) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    /**
     * Convert a worker name into a URL-safe slug.
     */
    function makeSlug(name) {
        return String(name || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    /**
     * Profession-to-services mapping for the Services
     * Offered pills.
     */
    const SERVICES_MAP = {
        'Plumber': ['Pipe Repair', 'Leak Fixing', 'Tap Installation', 'Bathroom Fittings', 'Emergency Plumbing'],
        'Electrician': ['Home Wiring', 'Switchboard Repair', 'Appliance Repair', 'Lighting Installation', 'Electrical Safety'],
        'Carpenter': ['Furniture Repair', 'Modular Kitchen', 'Custom Woodwork', 'Wardrobe Fitting', 'Door & Frame'],
        'Cleaner': ['Deep Cleaning', 'Kitchen Cleaning', 'Post-Move Clean', 'Sofa Cleaning', 'Window Cleaning'],
        'Painter': ['Interior Painting', 'Exterior Painting', 'Wall Finishing', 'Color Consultation', 'Texture Work'],
        'AC Repair': ['AC Installation', 'Servicing', 'Gas Refilling', 'Split/Window Units', 'Ducting'],
        'Handyman': ['Drilling', 'Mounting', 'Furniture Assembly', 'Small Repairs', 'Installation'],
        'Pest Control': ['Cockroach Control', 'Termite Treatment', 'Rodent Management', 'Eco-Friendly Solutions', 'Prevention'],
        'Laborer': ['Site Preparation', 'Material Handling', 'Finishing Support', 'Heavy Lifting', 'Site Cleanup'],
        'Helper': ['Cleaning Support', 'Material Transport', 'On-site Coordination', 'Tool Assistance', 'Setup Help'],
    };

    /**
     * Quick-info field definitions for the 2-column grid.
     */
    const INFO_ITEMS = [
        { key: 'profession',   label: 'Occupation',   icon: '&#128188;' },
        { key: 'experience',   label: 'Experience',   icon: '&#128188;' },
        { key: 'mobile',       label: 'Mobile No.',   icon: '&#128241;' },
        { key: 'email',        label: 'Email ID',     icon: '&#9993;' },
        { key: 'location',     label: 'Location',     icon: '&#127968;' },
        { key: 'qualification',label: 'Qualification',icon: '&#127891;' },
        { key: 'price',        label: 'Service Price',icon: '&#128176;' },
    ];

    /**
     * Read a query-string parameter.
     */
    function readQueryParam(name) {
        try {
            const params = new URLSearchParams(window.location.search);
            const value = params.get(name);
            return value == null ? null : String(value).trim();
        } catch (e) {
            return null;
        }
    }

    /**
     * Read the real worker ID from the URL (?worker_id=<id>)
     * first, then sessionStorage.
     */
    function readWorkerId() {
        const fromUrl = readQueryParam('worker_id');
        if (fromUrl) return fromUrl;
        try {
            const fromStorage = sessionStorage.getItem('handyhire.selectedWorkerId');
            if (fromStorage) return fromStorage.trim();
        } catch (e) {}
        return null;
    }

    /**
     * Read context metadata stored by the Team Page.
     */
    function readSelectedMember() {
        try {
            const raw = sessionStorage.getItem('handyhire.selectedMember');
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Build a star-rating string.
     */
    function buildStars(rating) {
        const r = Math.max(0, Math.min(5, Number(rating) || 0));
        const full = Math.floor(r);
        const half = (r - full) >= 0.5 ? 1 : 0;
        const empty = 5 - full - half;
        return '\u2605'.repeat(full) + (half ? '\u00BD' : '') + '\u2606'.repeat(empty);
    }

    /**
     * Generate a placeholder avatar data URL.
     */
    function buildAvatar(name) {
        const initials = name
            .split(' ')
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase())
            .slice(0, 2)
            .join('') || '?';

        const hue = Array.from(name).reduce(
            (sum, ch) => sum + ch.charCodeAt(0),
            0
        ) % 360;

        const svg = `
            <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'>
                <defs>
                    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
                        <stop offset='0%' stop-color='hsl(${hue}, 35%, 70%)'/>
                        <stop offset='100%' stop-color='hsl(${hue}, 40%, 55%)'/>
                    </linearGradient>
                </defs>
                <circle cx='60' cy='60' r='60' fill='url(#g)'/>
                <text x='50%' y='54%' text-anchor='middle'
                      font-family='Inter, sans-serif' font-size='44'
                      font-weight='700' fill='#ffffff' dominant-baseline='middle'>
                    ${initials}
                </text>
            </svg>
        `.trim();

        return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
    }

    /**
     * Populate the hero profile section.
     */
    function populate(worker) {
        const avatar = document.getElementById('profileAvatar');
        const nameEl = document.getElementById('profileName');
        const occEl = document.getElementById('profileOccupation');
        const bioEl = document.getElementById('profileBio');
        const ratingVal = document.getElementById('heroRatingValue');
        const ratingStars = document.getElementById('heroStars');
        const ratingCount = document.getElementById('heroRatingCount');

        if (avatar && nameEl) {
            if (worker.profile_image) {
                avatar.style.backgroundImage = 'url("' + worker.profile_image + '")';
            } else {
                avatar.style.backgroundImage = buildAvatar(worker.name);
            }
        }
        if (nameEl) nameEl.textContent = worker.name;
        if (occEl) occEl.textContent = worker.profession;
        if (bioEl) bioEl.textContent = worker.shortDescription || '';

        if (ratingVal) ratingVal.textContent = (Number(worker.rating) || 0).toFixed(1);
        if (ratingStars) ratingStars.textContent = buildStars(worker.rating);
        if (ratingCount) {
            const n = Number(worker.reviewCount) || 0;
            ratingCount.textContent = n + (n === 1 ? ' review' : ' reviews');
        }

        document.title = worker.name + ' | HandyHire';
    }

    /**
     * Render the availability strip.
     */
    function renderAvailability(worker) {
        const text = document.getElementById('availabilityText');
        if (text) {
            text.textContent = worker.availability && worker.availability !== '--'
                ? worker.availability
                : 'Available today';
        }
    }

    /**
     * Render the Quick Info 2-column grid.
     */
    function renderInfoGrid(worker) {
        const grid = document.getElementById('infoGrid');
        if (!grid) return;

        grid.innerHTML = INFO_ITEMS.map(function (item) {
            const value = worker[item.key] || '--';
            return '<li class="info-card">' +
                '<span class="info-card-icon" aria-hidden="true">' + item.icon + '</span>' +
                '<div class="info-card-text">' +
                    '<p class="info-card-label">' + item.label + '</p>' +
                    '<p class="info-card-value">' + value + '</p>' +
                '</div>' +
            '</li>';
        }).join('');
    }

    /**
     * Compose the About Professional paragraph.
     */
    function composeAbout(worker) {
        const aboutEl = document.getElementById('aboutText');
        if (!aboutEl) return;

        const name = worker.name || 'This professional';
        const experience = worker.experience || '';
        const location = worker.location || '';
        const desc = worker.shortDescription || '';

        let text = desc;
        if (experience) {
            text += ' ' + name + ' brings ' + experience + ' of professional experience.';
        }
        if (location) {
            text += ' Based in ' + location + '.';
        }
        aboutEl.textContent = text.trim() || 'Professional details will appear here.';
    }

    /**
     * Render the Services Offered pills.
     */
    function renderServices(worker) {
        const list = document.getElementById('servicesPills');
        if (!list) return;

        const services = SERVICES_MAP[worker.profession] || ['General Maintenance', 'Consultation', 'On-site Service'];
        list.innerHTML = services.map(function (s) {
            return '<li class="service-pill">' + s + '</li>';
        }).join('');
    }

    /**
     * Render the reviews list.
     */
    function renderReviews(worker) {
        const list = document.getElementById('reviewsList');
        const empty = document.getElementById('reviewsEmpty');
        const score = document.getElementById('reviewsScore');
        const summaryStars = document.getElementById('reviewsSummaryStars');
        const summaryCount = document.getElementById('reviewsSummaryCount');

        if (score) score.textContent = (Number(worker.rating) || 0).toFixed(1);
        if (summaryStars) summaryStars.textContent = buildStars(worker.rating);

        const reviews = Array.isArray(worker.reviews) ? worker.reviews : [];
        if (summaryCount) {
            const n = Number(worker.reviewCount) || reviews.length;
            summaryCount.textContent = 'Based on ' + n + (n === 1 ? ' review' : ' reviews');
        }

        if (!list) return;

        if (!reviews.length) {
            list.innerHTML = '';
            if (empty) empty.hidden = false;
            return;
        }

        if (empty) empty.hidden = true;

        list.innerHTML = reviews.map(function (review) {
            const stars = buildStars(review.rating);
            const author = review.author || 'Customer';
            const text = review.text || '';
            const date = review.date || '';
            const safeText = String(text).replace(/[&<>"]/g, function (c) {
                return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
            });
            const safeAuthor = String(author).replace(/[&<>"]/g, function (c) {
                return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
            });
            return `
                <li class="review-card">
                    <div class="review-top">
                        <p class="review-author">${safeAuthor}</p>
                        <span class="review-stars" aria-label="${review.rating} out of 5">${stars}</span>
                    </div>
                    <p class="review-text">${safeText}</p>
                    <p class="review-date">${date}</p>
                </li>
            `;
        }).join('');
    }

    /**
     * Show a lightweight loading message in the hero area.
     */
    function renderEmptyState(message) {
        const nameEl = document.getElementById('profileName');
        const occEl = document.getElementById('profileOccupation');
        const bioEl = document.getElementById('profileBio');
        if (nameEl) nameEl.textContent = message || 'Loading...';
        if (occEl) occEl.textContent = 'Please wait';
        if (bioEl) bioEl.textContent = 'Fetching this professional\u2019s details from the database.';
        const grid = document.getElementById('infoGrid');
        if (grid) grid.innerHTML = '';
        const list = document.getElementById('reviewsList');
        if (list) list.innerHTML = '';
        const empty = document.getElementById('reviewsEmpty');
        if (empty) empty.hidden = true;
    }

    /**
     * Show an error state in the hero area.
     */
    function showError(message) {
        const nameEl = document.getElementById('profileName');
        const occEl = document.getElementById('profileOccupation');
        const bioEl = document.getElementById('profileBio');
        if (nameEl) nameEl.textContent = 'Unable to load';
        if (occEl) occEl.textContent = '';
        if (bioEl) bioEl.textContent = message;
        const grid = document.getElementById('infoGrid');
        if (grid) grid.innerHTML = '';
        const list = document.getElementById('reviewsList');
        if (list) list.innerHTML = '';
        const empty = document.getElementById('reviewsEmpty');
        if (empty) empty.hidden = true;
    }

    /**
     * Wire up the Back button href from sessionStorage.
     */
    function initBackButton() {
        const back = document.getElementById('backLink');
        if (!back || back.hidden) return;
        try {
            const prev = sessionStorage.getItem('handyhire.provider.previousPage');
            if (prev && prev.trim()) {
                back.setAttribute('href', prev.trim());
            }
        } catch (e) {
            // Keep the HTML fallback.
        }
        back.addEventListener('click', function (event) {
            event.preventDefault();
            const href = back.getAttribute('href');
            if (href) {
                window.location.href = href;
            }
        });
    }

    /**
     * Wire up navigation for team vs individual context.
     */
    function initNavigation(context) {
        const backLink = document.getElementById('backLink');
        const backToTeamBtn = document.getElementById('backToTeamBtn');
        const isTeam = context && context.source === 'team';

        if (isTeam) {
            if (backLink) backLink.hidden = true;
            if (backToTeamBtn) backToTeamBtn.hidden = false;
        } else {
            if (backLink) backLink.hidden = false;
            if (backToTeamBtn) backToTeamBtn.hidden = true;
        }

        const brand = document.querySelector('.hire-topbar .brand-mark');
        if (brand) {
            brand.setAttribute('href', isTeam ? 'team-page.html' : 'home.html');
        }

        if (isTeam && backToTeamBtn) {
            const teamName = (context.member && context.member.team) || '';
            const label = teamName ? 'Back to ' + teamName : 'Back to Team';
            backToTeamBtn.textContent = label;
            backToTeamBtn.setAttribute('aria-label', label);
            backToTeamBtn.addEventListener('click', function (event) {
                event.preventDefault();
                window.location.href = 'team-page.html';
            });
        }
    }

    /**
     * Wire up the Book Now CTA.
     */
    function initBookNow(context) {
        const btn = document.getElementById('bookNowBtn');
        if (!btn) return;

        if (context && context.source === 'team') {
            btn.hidden = true;
            btn.setAttribute('aria-hidden', 'true');
            btn.tabIndex = -1;
            return;
        }

        btn.addEventListener('click', function () {
            try {
                const workerId = sessionStorage.getItem('handyhire.selectedWorkerId');
                const slug = sessionStorage.getItem('handyhire.selectedWorkerSlug');
                if (workerId) {
                    window.location.href = 'booking.html?worker_id=' + encodeURIComponent(workerId);
                    return;
                }
                if (slug) {
                    window.location.href = 'booking.html?worker=' + encodeURIComponent(slug);
                    return;
                }
            } catch (e) {
                // Ignore storage errors and fall back below.
            }
            window.location.href = 'booking.html';
        });
    }

    /**
     * Resolve the API helper.
     */
    function getApi() {
        if (window.HandyHireAPI && typeof window.HandyHireAPI.apiFetch === 'function') {
            return window.HandyHireAPI;
        }
        return {
            API_BASE_URL: 'http://127.0.0.1:8000',
            apiFetch: function (path) { return fetch('http://127.0.0.1:8000' + path); },
        };
    }

    /**
     * Fetch a single worker from the backend by database ID.
     */
    function fetchWorkerById(workerId) {
        return getApi().apiFetch('/api/workers/' + encodeURIComponent(String(workerId)))
            .then(function (response) {
                if (!response.ok) throw new Error('Worker not found');
                return response.json();
            });
    }

    /**
     * Fetch the worker's reviews from the backend.
     */
    function fetchWorkerReviews(workerId) {
        return getApi().apiFetch('/api/reviews/workers/' + encodeURIComponent(String(workerId)))
            .then(function (response) {
                if (!response.ok) return [];
                return response.json();
            })
            .catch(function () { return []; });
    }

    /**
     * Map a backend WorkerResponse + ReviewResponse[] into the
     * exact shape the existing render functions expect.
     */
    function mapApiWorkerToUi(w, reviews) {
        const name = w.full_name || w.name || 'Worker';
        const slug = makeSlug(name);
        const price = w.price != null && Number(w.price) > 0
            ? '\u20B9' + Number(w.price)
            : '--';

        return {
            name: name,
            profession: w.profession || '--',
            shortDescription: w.bio || '',
            price: price,
            rating: Number(w.average_rating) || 0,
            reviewCount: Number(w.review_count) || 0,
            experience: w.experience || '--',
            mobile: '--',
            email: '--',
            location: w.location || '--',
            qualification: w.qualification || '--',
            availability: w.availability || null,
            profile_image: w.profile_image || null,
            reviews: (Array.isArray(reviews) ? reviews : []).map(function (r) {
                return {
                    author: r.customer_name || 'Customer',
                    rating: Number(r.rating) || 0,
                    text: r.comment || '',
                    date: formatReviewDate(r.created_at),
                };
            }),
            __slug: slug,
            __workerId: w.id != null ? String(w.id) : null,
        };
    }

    /**
     * Turn an ISO review date into a short readable label.
     */
    function formatReviewDate(iso) {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return iso;
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return months[d.getMonth()] + ' ' + d.getFullYear();
        } catch (e) {
            return iso;
        }
    }

    /**
     * Render every section from a resolved worker object.
     */
    function renderAll(worker) {
        populate(worker);
        renderAvailability(worker);
        renderInfoGrid(worker);
        composeAbout(worker);
        renderServices(worker);
        renderReviews(worker);
        initBookNow(worker.__context || null);
        initNavigation(worker.__context || null);
        initBackButton();
    }

    /**
     * Initialize the Person Details page.
     */
    async function init() {
        if (!requireAuth()) return;

        const workerId = readWorkerId();
        if (!workerId) {
            showError('No worker selected. Please go back and choose a professional to view.');
            return;
        }

        renderEmptyState('Loading professional...');

        try {
            const results = await Promise.all([
                fetchWorkerById(workerId),
                fetchWorkerReviews(workerId)
            ]);
            const worker = mapApiWorkerToUi(results[0], results[1]);
            worker.__context = { source: readQueryParam('source'), member: readSelectedMember() };
            renderAll(worker);
        } catch (e) {
            showError('Unable to load this professional. Please try again later.');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
