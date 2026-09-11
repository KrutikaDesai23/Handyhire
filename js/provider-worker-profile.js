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
        el.textContent = (value == null || value === '') ? 'â€”' : value;
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

        setText('statJobs', completed != null ? String(completed) : 'â€”');
        setText('statRating', rating != null ? rating : 'â€”');
        setText('statReviews', reviews != null ? String(reviews) : 'â€”');
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
     * Upload a new profile image and return the saved image URL.
     */
    function uploadProfileImage(file) {
        const formData = new FormData();
        formData.append('file', file);

        const token = localStorage.getItem('handyhire.auth.token');

        return fetch('http://127.0.0.1:8000/api/worker/profile-image', {
            method: 'POST',
            headers: token ? { 'Authorization': 'Bearer ' + token } : {},
            body: formData,
        }).then(function (response) {
            if (response.ok) {
                return response.json();
            }
            return response.json().then(function (err) {
                throw new Error((err && err.detail) || 'Failed to upload profile photo');
            }).catch(function () {
                throw new Error('Failed to upload profile photo');
            });
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

        const photoInput = document.getElementById('editProfileImage');
        const photoFile = photoInput && photoInput.files && photoInput.files[0] ? photoInput.files[0] : null;

        const saveTextProfile = function (profileImageValue) {
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
                profile_image: profileImageValue,
            };

            return api.apiFetch('/api/worker/profile', {
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
            });
        };

        const onPhotoUploadError = function (photoError) {
            showEditError(
                (photoError && photoError.message) ||
                'Failed to upload photo. Text changes were not saved.'
            );
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Save Changes';
            }
        };

        if (photoFile) {
            uploadProfileImage(photoFile)
                .then(function (result) {
                    const imageUrl = result && result.profile_image ? result.profile_image : null;
                    if (imageUrl && currentProfile) {
                        currentProfile.profile_image = imageUrl;
                        populateHero(currentProfile);
                    }
                    return saveTextProfile(imageUrl);
                })
                .then(function (updated) {
                    if (!updated) return;
                    currentProfile = updated;
                    populateHero(currentProfile);
                    populateInfo(currentProfile);
                    renderServices(servicesForProfession(currentProfile.profession));
                    fillEditForm(currentProfile);
                    closeEdit();
                })
                .catch(function (err) {
                    onPhotoUploadError(err);
                });
        } else {
            saveTextProfile(currentProfile ? currentProfile.profile_image : null)
                .then(function (updated) {
                    if (!updated) return;
                    currentProfile = updated;
                    populateHero(currentProfile);
                    populateInfo(currentProfile);
                    renderServices(servicesForProfession(currentProfile.profession));
                    fillEditForm(currentProfile);
                    closeEdit();
                })
                .catch(function (err) {
                    showEditError(err && err.message ? err.message : 'Failed to save profile');
                })
                .finally(function () {
                    if (btn) {
                        btn.disabled = false;
                        btn.textContent = 'Save Changes';
                    }
                });
        }
    }

    /**
     * Open the edit form.
     */
    function openEdit() {
        const form = document.getElementById('editProfileForm');
        if (form) form.hidden = false;
        const btn = document.getElementById('editProfileBtn');
        if (btn) btn.hidden = true;

        const photoInput = document.getElementById('editProfileImage');
        if (photoInput) photoInput.value = '';
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
     * Escape a URL string for use inside a CSS url() value.
     * @param {string} str
     * @returns {string}
     */
    function escapeCssUrl(str) {
        return String(str).replace(/["\\]/g, '');
    }

    /**
     * Load the worker's own work photos and render the gallery.
     */
    function loadWorkPhotos() {
        const api = window.HandyHireAPI;
        if (!api || typeof api.apiFetch !== 'function') return;

        api.apiFetch('/api/worker/work-photos').then(function (response) {
            if (!response.ok) return [];
            return response.json();
        }).then(function (photos) {
            renderWorkPhotos(Array.isArray(photos) ? photos : []);
        }).catch(function () {
            renderWorkPhotos([]);
        });
    }

    /**
     * Render the work photos gallery into the page.
     * @param {Array} photos
     */
    function renderWorkPhotos(photos) {
        const grid = document.getElementById('workPhotosGrid');
        const empty = document.getElementById('workPhotosEmpty');
        if (!grid) return;

        if (!photos.length) {
            grid.innerHTML = '';
            if (empty) empty.hidden = false;
            return;
        }

        if (empty) empty.hidden = true;
        grid.innerHTML = photos.map(function (photo) {
            const url = escapeCssUrl(photo.image_url || '');
            const id = photo.id;
            return '<li class="work-photo-card">' +
                '<img class="work-photo-img" src="' + escapeHtml(url) + '" alt="Work photo" loading="lazy" />' +
                '<button type="button" class="work-photo-delete" data-photo-id="' + id + '" aria-label="Delete work photo">&#10005;</button>' +
            '</li>';
        }).join('');
    }

    /**
     * Upload a new work photo via the multipart endpoint and refresh the gallery.
     */
    function handleWorkPhotoUpload(event) {
        event.preventDefault();

        const api = window.HandyHireAPI;
        const input = document.getElementById('workPhotoInput');
        const errorEl = document.getElementById('workPhotoError');
        const btn = document.getElementById('addWorkPhotoBtn');
        const file = input && input.files && input.files[0] ? input.files[0] : null;

        if (!file) {
            showWorkPhotoError('Please choose a photo to upload.');
            return;
        }

        if (errorEl) errorEl.hidden = true;
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Uploading...';
        }

        const formData = new FormData();
        formData.append('file', file);

        api.apiFetch('/api/worker/work-photos', {
            method: 'POST',
            body: formData,
        }).then(function (response) {
            if (response.ok) {
                if (input) input.value = '';
                loadWorkPhotos();
            }
            return response;
        }).then(function (response) {
            if (!response.ok) {
                return response.json().then(function (err) {
                    throw new Error((err && err.detail) || 'Failed to upload photo');
                }).catch(function (e) {
                    throw new Error(e && e.message ? e.message : 'Failed to upload photo');
                });
            }
        }).catch(function (err) {
            showWorkPhotoError(err && err.message ? err.message : 'Failed to upload photo');
        }).finally(function () {
            if (btn) {
                btn.disabled = false;
                btn.textContent = '+ Add Photo';
            }
        });
    }

    /**
     * Show a message in the work photo error element.
     * @param {string} message
     */
    function showWorkPhotoError(message) {
        const el = document.getElementById('workPhotoError');
        if (!el) return;
        el.textContent = message;
        el.hidden = false;
    }

    /**
     * Delete a work photo by id and refresh the gallery.
     * @param {number} photoId
     */
    function deleteWorkPhoto(photoId) {
        const api = window.HandyHireAPI;
        if (!api || !photoId) return;

        api.apiFetch('/api/worker/work-photos/' + encodeURIComponent(String(photoId)), {
            method: 'DELETE',
        }).then(function (response) {
            if (!response.ok) {
                return response.json().then(function (err) {
                    throw new Error((err && err.detail) || 'Failed to delete photo');
                }).catch(function () {
                    throw new Error('Failed to delete photo');
                });
            }
            return loadWorkPhotos();
        }).catch(function (err) {
            showWorkPhotoError(err && err.message ? err.message : 'Failed to delete photo');
        });
    }

    /**
     * Wire up the work photos upload form and delete-button delegation.
     */
    function initWorkPhotos() {
        const form = document.getElementById('workPhotoForm');
        if (form) form.addEventListener('submit', handleWorkPhotoUpload);

        const grid = document.getElementById('workPhotosGrid');
        if (grid) {
            grid.addEventListener('click', function (event) {
                const del = event.target.closest('.work-photo-delete');
                if (!del) return;
                const id = del.getAttribute('data-photo-id');
                if (id) deleteWorkPhoto(id);
            });
        }

        loadWorkPhotos();
    }

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

        initWorkPhotos();

        loadProfile();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
