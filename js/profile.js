/* =========================================================
   HandyHire - Customer Profile JavaScript
   Loads the authenticated customer's real profile from
   GET /api/customer/profile. Edit/save uses PUT on the
   same endpoint.
   ========================================================= */

(function () {
    'use strict';

    let currentProfile = null;
    let selectedProfileImageFile = null;

    /**
     * Require an authenticated customer session.
     */
    function requireAuth() {
        if (
            !window.HandyHireAPI ||
            typeof window.HandyHireAPI.requireRole !== 'function'
        ) {
            window.location.href = 'login.html';
            return false;
        }

        return window.HandyHireAPI.requireRole('customer');
    }

    /**
     * Generate a placeholder avatar when no photo exists.
     */
    function buildAvatar(name) {
        const safeName = String(name || 'Customer');

        const initials = safeName
            .split(' ')
            .filter(Boolean)
            .map(function (part) {
                return part.charAt(0).toUpperCase();
            })
            .slice(0, 2)
            .join('') || '?';

        const hue = Array.from(safeName).reduce(
            function (sum, ch) {
                return sum + ch.charCodeAt(0);
            },
            0
        ) % 360;

        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg"
                 viewBox="0 0 120 120">
                <defs>
                    <linearGradient id="g"
                                    x1="0"
                                    y1="0"
                                    x2="1"
                                    y2="1">
                        <stop
                            offset="0%"
                            stop-color="hsl(${hue}, 35%, 70%)"
                        />
                        <stop
                            offset="100%"
                            stop-color="hsl(${hue}, 40%, 55%)"
                        />
                    </linearGradient>
                </defs>

                <circle
                    cx="60"
                    cy="60"
                    r="60"
                    fill="url(#g)"
                />

                <text
                    x="50%"
                    y="54%"
                    text-anchor="middle"
                    font-family="Inter, sans-serif"
                    font-size="44"
                    font-weight="700"
                    fill="#ffffff"
                    dominant-baseline="middle"
                >
                    ${initials}
                </text>
            </svg>
        `.trim();

        return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
    }

    /**
     * Set text content.
     */
    function setText(id, value) {
        const el = document.getElementById(id);

        if (!el) return;

        el.textContent =
            value == null || value === ''
                ? '--'
                : value;
    }

    /**
     * Populate profile page.
     */
    function populateProfile(profile) {
        setText(
            'profileHeroName',
            profile.full_name
        );

        setText(
            'infoFullName',
            profile.full_name
        );

        setText(
            'infoMobile',
            profile.mobile_number
        );

        setText(
            'infoEmail',
            profile.email
        );

        setText(
            'infoAddress',
            profile.address
        );

        setText(
            'infoCity',
            profile.city
        );

        const avatar =
            document.getElementById(
                'profileHeroAvatar'
            );

        if (avatar) {
            if (profile.profile_image) {
                avatar.style.backgroundImage =
                    'url("' +
                    profile.profile_image +
                    '")';
            } else if (profile.full_name) {
                avatar.style.backgroundImage =
                    buildAvatar(
                        profile.full_name
                    );
            }
        }
    }

    /**
     * Show profile loading error.
     */
    function showError(message) {
        const nameEl =
            document.getElementById(
                'profileHeroName'
            );

        if (nameEl) {
            nameEl.textContent =
                'Unable to load profile';
        }

        const tagline =
            document.getElementById(
                'profileHeroTagline'
            );

        if (tagline) {
            tagline.textContent = message;
        }
    }

    /**
     * Load customer profile.
     */
    function loadProfile() {
        const api =
            window.HandyHireAPI;

        const nameEl =
            document.getElementById(
                'profileHeroName'
            );

        if (nameEl) {
            nameEl.textContent =
                'Loading...';
        }

        api.apiFetch(
            '/api/customer/profile'
        )
            .then(function (response) {
                if (response.status === 401) {
                    api.clearAuth();
                    window.location.href =
                        'login.html';
                    return null;
                }

                if (response.status === 403) {
                    showError(
                        'You do not have access to this profile.'
                    );
                    return null;
                }

                if (!response.ok) {
                    showError(
                        'Unable to load profile. Please try again.'
                    );
                    return null;
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
                showError(
                    'Network error. Please check your connection and try again.'
                );
            });
    }

    /**
     * Fill edit form.
     */
    function fillEditForm(profile) {
        const set = function (
            id,
            value
        ) {
            const el =
                document.getElementById(id);

            if (el) {
                el.value =
                    value == null
                        ? ''
                        : value;
            }
        };

        set(
            'editFullName',
            profile.full_name
        );

        set(
            'editEmail',
            profile.email
        );

        set(
            'editMobile',
            profile.mobile_number
        );

        set(
            'editAddress',
            profile.address
        );

        set(
            'editCity',
            profile.city
        );
    }

    /**
     * Show edit form error.
     */
    function showEditError(message) {
        const el =
            document.getElementById(
                'editError'
            );

        if (!el) return;

        if (message) {
            el.textContent = message;
            el.hidden = false;
        } else {
            el.textContent = '';
            el.hidden = true;
        }
    }

    /**
     * Open edit form.
     */
    function openEdit() {
        const form =
            document.getElementById(
                'editProfileForm'
            );

        const btn =
            document.getElementById(
                'editProfileBtn'
            );

        if (form) {
            form.hidden = false;
        }

        if (btn) {
            btn.hidden = true;
        }
    }

    /**
     * Close edit form.
     */
    function closeEdit() {
        const form =
            document.getElementById(
                'editProfileForm'
            );

        const btn =
            document.getElementById(
                'editProfileBtn'
            );

        if (form) {
            form.hidden = true;
        }

        if (btn) {
            btn.hidden = false;
        }

        showEditError('');
    }

    /**
     * Resize/compress selected profile image.
     */
    function readProfileImage(file) {
        return new Promise(
            function (resolve, reject) {
                if (!file) {
                    resolve(null);
                    return;
                }

                const allowedTypes = [
                    'image/jpeg',
                    'image/png',
                    'image/webp'
                ];

                if (
                    !allowedTypes.includes(
                        file.type
                    )
                ) {
                    reject(
                        new Error(
                            'Please select a JPG, PNG or WebP image.'
                        )
                    );
                    return;
                }

                const reader =
                    new FileReader();

                reader.onload =
                    function () {
                        const img =
                            new Image();

                        img.onload =
                            function () {
                                const maxSize =
                                    500;

                                let width =
                                    img.width;

                                let height =
                                    img.height;

                                if (
                                    width >
                                        height &&
                                    width >
                                        maxSize
                                ) {
                                    height =
                                        Math.round(
                                            height *
                                                maxSize /
                                                width
                                        );

                                    width =
                                        maxSize;
                                } else if (
                                    height >
                                    maxSize
                                ) {
                                    width =
                                        Math.round(
                                            width *
                                                maxSize /
                                                height
                                        );

                                    height =
                                        maxSize;
                                }

                                const canvas =
                                    document.createElement(
                                        'canvas'
                                    );

                                canvas.width =
                                    width;

                                canvas.height =
                                    height;

                                const ctx =
                                    canvas.getContext(
                                        '2d'
                                    );

                                if (!ctx) {
                                    reject(
                                        new Error(
                                            'Unable to process the selected image.'
                                        )
                                    );
                                    return;
                                }

                                ctx.drawImage(
                                    img,
                                    0,
                                    0,
                                    width,
                                    height
                                );

                                resolve(
                                    canvas.toDataURL(
                                        'image/jpeg',
                                        0.8
                                    )
                                );
                            };

                        img.onerror =
                            function () {
                                reject(
                                    new Error(
                                        'Unable to process the selected image.'
                                    )
                                );
                            };

                        img.src =
                            reader.result;
                    };

                reader.onerror =
                    function () {
                        reject(
                            new Error(
                                'Unable to read the selected image.'
                            )
                        );
                    };

                reader.readAsDataURL(
                    file
                );
            }
        );
    }

    /**
     * Save customer profile.
     */
    function handleSave(event) {
        event.preventDefault();

        showEditError('');

        const api =
            window.HandyHireAPI;

        if (
            !api ||
            typeof api.apiFetch !==
                'function'
        ) {
            showEditError(
                'Unable to connect to HandyHire.'
            );
            return;
        }

        const btn =
            document.getElementById(
                'saveProfileBtn'
            );

        if (btn) {
            btn.disabled = true;
            btn.textContent =
                'Saving...';
        }

        const val = function (id) {
            const el =
                document.getElementById(id);

            return el
                ? el.value.trim()
                : '';
        };

        const payload = {
            full_name:
                val('editFullName'),

            email:
                val('editEmail'),

            mobile_number:
                val('editMobile'),

            address:
                val('editAddress'),

            city:
                val('editCity')
        };

        const imageInput =
            document.getElementById(
                'editProfileImage'
            );

        const imageFile =
            imageInput &&
            imageInput.files &&
            imageInput.files.length
                ? imageInput.files[0]
                : null;

        readProfileImage(imageFile)

            .then(
                function (
                    profileImage
                ) {
                    if (profileImage) {
                        payload.profile_image =
                            profileImage;
                    }

                    return api.apiFetch(
                        '/api/customer/profile',
                        {
                            method:
                                'PUT',

                            body:
                                JSON.stringify(
                                    payload
                                )
                        }
                    );
                }
            )

            .then(function (response) {
                if (
                    response.status ===
                    401
                ) {
                    api.clearAuth();

                    window.location.href =
                        'login.html';

                    return null;
                }

                if (
                    response.status ===
                    403
                ) {
                    throw new Error(
                        'You do not have permission to update this profile.'
                    );
                }

                if (!response.ok) {
                    return response
                        .json()
                        .then(
                            function (err) {
                                const detail =
                                    err &&
                                    err.detail;

                                if (
                                    typeof detail ===
                                    'string'
                                ) {
                                    throw new Error(
                                        detail
                                    );
                                }

                                throw new Error(
                                    'Failed to save profile'
                                );
                            }
                        );
                }

                return response.json();
            })

            .then(function (updated) {
                if (!updated) return;

                currentProfile =
                    updated;

                populateProfile(
                    updated
                );

                fillEditForm(
                    updated
                );

                if (imageInput) {
                    imageInput.value = '';
                }

                closeEdit();
            })

            .catch(function (err) {
                showEditError(
                    err &&
                    err.message
                        ? err.message
                        : 'Failed to save profile'
                );
            })

            .finally(function () {
                if (btn) {
                    btn.disabled = false;

                    btn.textContent =
                        'Save Changes';
                }
            });
    }

    /**
     * Sign out.
     */
    function initSignOut() {
        const btn =
            document.getElementById(
                'signOutBtn'
            );

        if (!btn) return;

        btn.addEventListener(
            'click',
            function () {
                if (
                    window.HandyHireAPI
                ) {
                    window.HandyHireAPI
                        .clearAuth();
                }

                window.location.href =
                    '../index.html';
            }
        );
    }

    /**
     * Initialize page.
     */
    function init() {
        if (!requireAuth()) {
            return;
        }

        initSignOut();

        const editBtn =
            document.getElementById(
                'editProfileBtn'
            );

        if (editBtn) {
            editBtn.addEventListener(
                'click',
                openEdit
            );
        }

        const cancelBtn =
            document.getElementById(
                'cancelEditBtn'
            );

        if (cancelBtn) {
            cancelBtn.addEventListener(
                'click',
                closeEdit
            );
        }

        const form =
            document.getElementById(
                'editProfileForm'
            );

        if (form) {
            form.addEventListener(
                'submit',
                handleSave
            );
        }

        loadProfile();
    }

    if (
        document.readyState ===
        'loading'
    ) {
        document.addEventListener(
            'DOMContentLoaded',
            init
        );
    } else {
        init();
    }
})();
