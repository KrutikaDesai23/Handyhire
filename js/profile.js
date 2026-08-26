/* =========================================================
   HandyHire - Customer Profile JavaScript
   Loads the authenticated customer's real profile from
   GET /api/customer/profile. Edit/save uses PUT on the
   same endpoint. No mock/fallback customer data is shown
   for authenticated users.
   ========================================================= */

(function () {
    'use strict';

    let currentProfile = null;

    /**
     * Require an authenticated customer session.
     * @returns {boolean}
     */
    function requireAuth() {
        if (!(window.HandyHireAPI && typeof window.HandyHireAPI.requireRole === 'function')) {
            window.location.href = 'login.html';
            return false;
        }
        return window.HandyHireAPI.requireRole('customer');
    }

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
     * Generate a placeholder avatar data URL.
     * @param {string} name
     * @returns {string}
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
     * Set text content of an element when both are present.
     * Uses "--" for empty/null values.
     */
    function setText(id, value) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = value == null || value === '' ? '--' : value;
    }

    /**
     * Populate the profile page from backend data.
     * @param {Object} profile
     */
    function populateProfile(profile) {
        setText('profileHeroName', profile.full_name);
        setText('infoFullName', profile.full_name);
        setText('infoMobile', profile.mobile_number);
        setText('infoEmail', profile.email);
        setText('infoAddress', profile.address);
        setText('infoCity', profile.city);

        const avatar = document.getElementById('profileHeroAvatar');
        if (avatar && profile.full_name) {
            avatar.style.backgroundImage = buildAvatar(profile.full_name);
        }
    }

    /**
     * Show an error message in the hero area.
     */
    function showError(message) {
        const nameEl = document.getElementById('profileHeroName');
        if (nameEl) nameEl.textContent = 'Unable to load profile';
        const tagline = document.getElementById('profileHeroTagline');
        if (tagline) tagline.textContent = message;
    }

    /**
     * Load the customer profile from the backend.
     */
    function loadProfile() {
        const api = window.HandyHireAPI;
        const nameEl = document.getElementById('profileHeroName');
        if (nameEl) nameEl.textContent = 'Loading...';

        api.apiFetch('/api/customer/profile')
            .then(function (response) {
                if (response.status === 401) {
                    api.clearAuth();
                    window.location.href = 'login.html';
                    return;
                }
                if (response.status === 403) {
                    showError('You do not have access to this profile.');
                    return;
                }
                if (!response.ok) {
                    showError('Unable to load profile. Please try again.');
                    return;
                }
                return response.json();
            })
            .then(function (profile) {
                if (!profile) return;
                currentProfile = profile;
                populateProfile(profile);
                fillEditForm(profile);
            })
            .catch(function () {
                showError('Network error. Please check your connection and try again.');
            });
    }

    /**
     * Fill the edit form with current profile values.
     */
    function fillEditForm(profile) {
        const set = function (id, value) {
            const el = document.getElementById(id);
            if (el) el.value = value == null ? '' : value;
        };
        set('editFullName', profile.full_name);
        set('editEmail', profile.email);
        set('editMobile', profile.mobile_number);
        set('editAddress', profile.address);
        set('editCity', profile.city);
    }

    /**
     * Show an error in the edit form.
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
     * Save profile edits via PUT /api/customer/profile.
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

        const payload = {
            full_name: val('editFullName'),
            email: val('editEmail'),
            mobile_number: val('editMobile'),
            address: val('editAddress'),
            city: val('editCity'),
        };

        api.apiFetch('/api/customer/profile', {
            method: 'PUT',
            body: JSON.stringify(payload),
        }).then(function (response) {
            if (response.status === 401) {
                api.clearAuth();
                window.location.href = 'login.html';
                return;
            }
            if (response.status === 403) {
                showEditError('You do not have permission to update this profile.');
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
            populateProfile(updated);
            fillEditForm(updated);
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

    /**
     * Initialize the Customer Profile page.
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
