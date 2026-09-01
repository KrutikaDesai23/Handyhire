/* =========================================================
   HandyHire - Provider Worker Profile JavaScript
   Loads the authenticated provider's real profile from
   GET /api/worker/profile (and aggregate stats from
   GET /api/worker/dashboard) and lets the provider edit
   and save it via PUT /api/worker/profile.

   No mock/fallback data is shown for authenticated
   providers; the page requires a valid worker token and
   otherwise redirects to login.html.
   ========================================================= */

(function () {
    'use strict';

    /**
     * Skills-to-services mapping used only to render the
     * "My Services" pills from the worker's real profession.
     * This is a deterministic UI label map, not fabricated
     * per-worker data.
     */
    const SKILL_SERVICES = {
        'plumber':         ['Pipe Repair', 'Leak Fixing', 'Tap Installation', 'Bathroom Fittings', 'Emergency Plumbing'],
        'electrician':     ['Home Wiring', 'Switchboard Repair', 'Appliance Repair', 'Lighting Installation', 'Safety Audit'],
        'carpenter':       ['Furniture Repair', 'Modular Kitchen', 'Custom Woodwork', 'Wardrobe Fitting', 'Door Frames'],
        'painter':         ['Interior Painting', 'Exterior Painting', 'Wall Finishing', 'Color Consultation', 'Texture Work'],
        'cleaner':         ['Deep Cleaning', 'Kitchen Cleaning', 'Post-Move Clean', 'Sofa Cleaning', 'Window Cleaning'],
        'ac repair':       ['AC Installation', 'Servicing', 'Gas Refilling', 'Split/Window Units', 'Ducting'],
        'ac-repair':       ['AC Installation', 'Servicing', 'Gas Refilling', 'Split/Window Units', 'Ducting'],
        'pest control':    ['Cockroach Control', 'Termite Treatment', 'Rodent Management', 'Eco-Friendly Solutions', 'Prevention'],
        'moving':          ['Packing', 'Loading', 'Unloading', 'Transport', 'Unpacking'],
        'gardener':        ['Lawn Mowing', 'Pruning', 'Planting', 'Weeding', 'Garden Cleanup'],
        'handyman':        ['Drilling', 'Mounting', 'Furniture Assembly', 'Small Repairs', 'Installation'],
    };

    /**
     * Escape user-supplied text before injecting as HTML.
     * @param {string} str
     * @returns {string}
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
     * Set the text content of an element when both are present.
     */
    function setText(id, value) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = (value == null || value === '') ? '—' : value;
    }

    /**
     * Generate a placeholder avatar data URL from the name.
     * @param {string} name
     * @returns {string} CSS background value
     */
    function buildAvatar(name) {
        const clean = String(name || '?').trim() || '?';
        const initials = clean
            .split(' ')
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase())
            .slice(0, 2)
            .join('') || '?';

        const hue = Array.from(clean).reduce(
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
     * Resolve a services list from the worker's profession.
     * Falls back to a single profession pill so the UI never
     * invents extra data.
     * @param {string} profession
     * @returns {Array<string>}
     */
    function servicesForProfession(profession) {
        const key = String(profession || '').toLowerCase().trim();
        if (SKILL_SERVICES[key]) return SKILL_SERVICES[key];
        return profession ? [profession] : [];
    }

    /**
     * Render the "My Services" pills.
     * @param {Array<string>} services
     */
    function renderServices(services) {
        const list = document.getElementById('servicesPills');
        if (!list) return;

        const items = Array.isArray(services) && services.length
            ? services
            : ['General Maintenance', 'Consultation', 'On-site Service'];

        list.innerHTML = items.map(function (s) {
            return '<li class="service-pill">' + escapeHtml(s) + '</li>';
        }).join('');
    }

    /**
     * Require an authenticated worker. Redirects to login
     * when there is no token and never shows fake data.
     * @returns {boolean} true when authenticated
     */
    function requireAuth() {
        if (!(window.HandyHireAPI && typeof window.HandyHireAPI.requireRole === 'function')) {
            window.location.href = 'login.html';
            return false;
        }
        return window.HandyHireAPI.requireRole('worker');
    }

    /**
     * Populate the hero section from the backend profile.
     * @param {Object} profile
     */
    function populateHero(profile) {
        const name = profile.full_name || 'Provider';
        setText('profileHeroName', name);
        setText('profileHeroTagline', profile.bio || 'Professional services on HandyHire.');

        const avatar = document.getElementById('profileHeroAvatar');
        if (avatar) {
            if (profile.profile_image) {
                avatar.style.backgroundImage = 'url("' + profile.profile_image + '")';
            } else {
                avatar.style.backgroundImage = buildAvatar(name);
            }
        }

        const availabilityText = document.querySelector('#availabilityBadge .availability-text')
            || document.querySelector('.availability-card .availability-text');
        if (availabilityText) {
            availabilityText.textContent = profile.availability && profile.availability.trim()
                ? profile.availability
                : 'Available today';
        }
    }

    /**
     * Populate the professional information cards from the
     * backend profile.
     * @param {Object} profile
     */
    function populateInfo(profile) {
        setText('infoProfession', profile.profession);
        setText('infoExperience', profile.experience);
        setText('infoQualification', profile.qualification);

        const location = profile.location
            || [profile.city, profile.address].filter(Boolean).join(', ');
        setText('infoLocation', location);
        setText('infoMobile', profile.mobile_number);
        setText('infoEmail', profile.email);
    }

    /**
     * Populate the statistics cards.
     * @param {Object} profile  GET /api/worker/profile response
     * @param {Object} dashboard GET /api/worker/dashboard response
     */
    function populateStats(profile, dashboard) {
        const completed = dashboard && typeof dashboard.completed_bookings === 'number'
            ? dashboard.completed_bookings
            : null;
        const rating = dashboard && dashboard.average_rating != null
            ? Number(dashboard.average_rating).toFixed(1)
            : null;
        const reviews = dashboard && typeof dashboard.review_count === 'number'
            ? dashboard.review_count
            : null;

        setText('statJobs', completed != null ? String(completed) : '—');
        setText('statRating', rating != null ? rating : '—');
        setText('statReviews', reviews != null ? String(reviews) : '—');
        setText('statExperience', profile.experience);
    }

    /**
     * Fill the edit form with the current profile values.
     * @param {Object} profile
     */
    function fillEditForm(profile) {
        const set = function (id, value) {
            const el = document.getElementById(id);
            if (el) el.value = value == null ? '' : value;
        };
        set('editFullName', profile.full_name);
        set('editEmail', profile.email);
        set('editProfession', profile.profession);
        set('editMobile', profile.mobile_number);
        set('editLocation', profile.location);
        set('editAddress', profile.address);
        set('editCity', profile.city);
        set('editExperience', profile.experience);
        set('editQualification', profile.qualification);
        set('editBio', profile.bio);
        set('editPrice', profile.price);
        set('editAvailability', profile.availability);
    }

    /**
     * Show a message in the edit error element.
     * @param {string} message
     */
    function showEditError(message) {
        const el = document.getElementById('editError');
        if (!el) return;
        if (message) {
            el.textContent = message;
            el.hidden = false;
        } else {
            el.hidden = true;
        }
    }

    /**
     * Load the provider profile and dashboard in parallel.
     */
    function loadProfile() {
        const api = window.HandyHireAPI;
        const nameEl = document.getElementById('profileHeroName');
        if (nameEl) nameEl.textContent = 'Loading...';

        return Promise.all([
            api.apiFetch('/api/worker/profile'),
            api.apiFetch('/api/worker/dashboard'),
        ]).then(function (responses) {
            const profileResp = responses[0];
            const dashResp = responses[1];

            if (profileResp.status === 401 || profileResp.status === 403) {
                api.clearAuth();
                window.location.href = 'login.html';
                return;
            }
            if (!profileResp.ok) {
                throw new Error('Failed to load profile');
            }

            return profileResp.json().then(function (profile) {
                return dashResp.ok
                    ? dashResp.json().then(function (dash) {
                        return { profile: profile, dashboard: dash };
                    }).catch(function () {
                        return { profile: profile, dashboard: null };
                    })
                    : { profile: profile, dashboard: null };
            });
        }).then(function (data) {
            if (!data) return;
            currentProfile = data.profile;
            populateHero(currentProfile);
            populateInfo(currentProfile);
            populateStats(currentProfile, data.dashboard);
            renderServices(servicesForProfession(currentProfile.profession));
            fillEditForm(currentProfile);
        }).catch(function () {
            const heroName = document.getElementById('profileHeroName');
            if (heroName) heroName.textContent = 'Unable to load profile';
            const tagline = document.getElementById('profileHeroTagline');
            if (tagline) {
                tagline.textContent = 'Please check your connection and try again.';
            }
        });
    }

    /**
     * Persist profile edits via PUT /api/worker/profile.
     * @param {Event} event
     */
    function handleSave(event) {
        event.preventDefault();
        showEditError('');

        const api = window.HandyHireAPI;
        const btn = document.getElementById('saveProfileBtn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Saving...';
        }

        const val = function (id) {
            const el = document.getElementById(id);
            return el ? el.value.trim() : '';
        };
        const numVal = function (id) {
            const raw = val(id);
            if (raw === '') return null;
            const n = Number(raw);
            return isNaN(n) ? null : n;
        };

        const price = numVal('editPrice');
        if (val('editPrice') !== '' && (price == null || price <= 0)) {
            showEditError('Hourly rate must be a positive number.');
            if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
            return;
        }

        const payload = {
            full_name: val('editFullName'),
            email: val('editEmail'),
            mobile_number: val('editMobile'),
            profession: val('editProfession'),
            location: val('editLocation'),
            address: val('editAddress'),
            city: val('editCity'),
            experience: val('editExperience'),
            qualification: val('editQualification'),
            bio: val('editBio'),
            availability: val('editAvailability'),
            price: price,
        };

        api.apiFetch('/api/worker/profile', {
            method: 'PUT',
            body: JSON.stringify(payload),
        }).then(function (response) {
            if (response.status === 401 || response.status === 403) {
                api.clearAuth();
                window.location.href = 'login.html';
                return;
            }
            if (!response.ok) {
                return response.json().then(function (err) {
                    throw new Error(err && err.detail ? err.detail : 'Failed to save profile');
                }).catch(function () {
                    throw new Error('Failed to save profile');
                });
            }
            return response.json();
        }).then(function (updated) {
            if (!updated) return;
            currentProfile = updated;
            populateHero(currentProfile);
            populateInfo(currentProfile);
            renderServices(servicesForProfession(currentProfile.profession));
            fillEditForm(currentProfile);
            closeEdit();
        }).catch(function (err) {
            showEditError(err && err.message ? err.message : 'Failed to save profile');
        }).finally(function () {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Save Changes';
            }
        });
    }

    /**
     * Open the edit form.
     */
    function openEdit() {
        const form = document.getElementById('editProfileForm');
        if (form) form.hidden = false;
        const btn = document.getElementById('editProfileBtn');
        if (btn) btn.hidden = true;
    }

    /**
     * Close the edit form and clear any error.
     */
    function closeEdit() {
        const form = document.getElementById('editProfileForm');
        if (form) form.hidden = true;
        const btn = document.getElementById('editProfileBtn');
        if (btn) btn.hidden = false;
        showEditError('');
    }

    /**
     * Wire up the Sign Out button.
     */
    function initSignOut() {
        const btn = document.getElementById('signOutBtn');
        if (!btn) return;
        btn.addEventListener('click', function () {
            if (window.HandyHireAPI) {
                window.HandyHireAPI.clearAuth();
            }
            window.location.href = '../index.html';
        });
    }

    let currentProfile = null;

    /**
     * Initialize the Provider Worker Profile page.
     */
    function init() {
        if (!requireAuth()) return;

        initSignOut();

        const editBtn = document.getElementById('editProfileBtn');
        if (editBtn) editBtn.addEventListener('click', openEdit);

        const cancelBtn = document.getElementById('cancelEditBtn');
        if (cancelBtn) cancelBtn.addEventListener('click', closeEdit);

        const form = document.getElementById('editProfileForm');
        if (form) form.addEventListener('submit', handleSave);

        loadProfile();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
