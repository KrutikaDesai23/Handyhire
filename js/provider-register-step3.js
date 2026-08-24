/* =========================================================
   HandyHire - Provider Registration Step 3 JavaScript
   Screen: SP R3 - Verification
   Handles file validation, identity number validation, and
   Back / Submit navigation.
   ========================================================= */

(function () {
    'use strict';

    /**
     * Destination routes.
     */
    const ROUTES = {
        BACK: 'provider-register-step2.html',
        SUBMIT: 'provider-home.html',
    };

    /**
     * File validation rules per field.
     * - maxSize: in bytes
     * - allowedTypes: array of MIME types or wildcard patterns
     */
    const FILE_RULES = {
        uploadPhoto: {
            maxSize: 2 * 1024 * 1024, // 2 MB
            allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
            allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
            label: 'photo',
        },
        photoIdentity: {
            maxSize: 5 * 1024 * 1024, // 5 MB
            allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
            allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
            label: 'identity document',
        },
        additionalDocuments: {
            maxSize: 5 * 1024 * 1024, // 5 MB
            allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
            allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
            label: 'additional document',
            optional: true,
        },
    };

    /**
     * Regex pattern for the identity number (alphanumeric, 6–20 chars).
     */
    const ID_NUMBER_PATTERN = /^[A-Za-z0-9]{6,20}$/;

    /**
     * Reference DOM elements.
     */
    /**
     * Skills-to-profession mapping for the registration API.
     */
    const SKILL_LABELS = {
        'plumber': 'Plumber',
        'electrician': 'Electrician',
        'carpenter': 'Carpenter',
        'painter': 'Painter',
        'cleaner': 'Cleaner',
        'ac-repair': 'AC / Appliance Repair',
        'pest-control': 'Pest Control',
        'moving': 'Moving & Packing',
        'gardener': 'Gardener',
        'handyman': 'General Handyman',
    };

    const form = document.getElementById('providerRegisterStep3Form');
    const backBtn = document.getElementById('backBtn');

    const uploadPhotoInput = document.getElementById('uploadPhoto');
    const photoIdentityInput = document.getElementById('photoIdentity');
    const identityNumberInput = document.getElementById('identityNumber');
    const additionalDocsInput = document.getElementById('additionalDocuments');

    /**
     * Get a human-readable file size string.
     * @param {number} bytes
     * @returns {string}
     */
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    /**
     * Get the file extension in lower case.
     * @param {string} name
     * @returns {string}
     */
    function getExtension(name) {
        const idx = name.lastIndexOf('.');
        return idx >= 0 ? name.slice(idx + 1).toLowerCase() : '';
    }

    /**
     * Validate a single file input against its rules.
     * @param {HTMLInputElement} input
     * @param {object} rules
     * @returns {boolean}
     */
    function validateFile(input, rules) {
        const wrapper = input.closest('.file-wrapper');
        const errorId = input.getAttribute('aria-describedby');
        const errorEl = errorId
            ? errorId.split(' ').map((id) => document.getElementById(id)).find((el) => el && el.classList.contains('form-error'))
            : null;

        // Optional field with no file selected is valid
        if (rules.optional && (!input.files || input.files.length === 0)) {
            if (wrapper) wrapper.classList.remove('has-error');
            input.removeAttribute('aria-invalid');
            if (errorEl) errorEl.textContent = '';
            return true;
        }

        if (!input.files || input.files.length === 0) {
            if (wrapper) wrapper.classList.add('has-error');
            input.setAttribute('aria-invalid', 'true');
            if (errorEl) errorEl.textContent = `Please upload your ${rules.label}.`;
            return false;
        }

        const file = input.files[0];
        const ext = getExtension(file.name);

        // Type check
        if (rules.allowedTypes.indexOf(file.type) === -1 && rules.allowedExtensions.indexOf(ext) === -1) {
            if (wrapper) wrapper.classList.add('has-error');
            input.setAttribute('aria-invalid', 'true');
            if (errorEl) errorEl.textContent = `Unsupported file type. Allowed: ${rules.allowedExtensions.join(', ').toUpperCase()}.`;
            return false;
        }

        // Size check
        if (file.size > rules.maxSize) {
            if (wrapper) wrapper.classList.add('has-error');
            input.setAttribute('aria-invalid', 'true');
            if (errorEl) errorEl.textContent = `File is too large (${formatFileSize(file.size)}). Max allowed: ${formatFileSize(rules.maxSize)}.`;
            return false;
        }

        if (wrapper) wrapper.classList.remove('has-error');
        input.removeAttribute('aria-invalid');
        if (errorEl) errorEl.textContent = '';
        return true;
    }

    /**
     * Update the visual label of a file input to reflect the chosen file.
     * @param {HTMLInputElement} input
     */
    function updateFileLabel(input) {
        const labelId = input.id + 'Label';
        const label = document.getElementById(labelId);
        if (!label) return;

        const textEl = label.querySelector('.file-text');
        if (!textEl) return;

        if (input.files && input.files.length > 0) {
            label.classList.add('file-selected');
            textEl.textContent = input.files[0].name;
        } else {
            label.classList.remove('file-selected');
            textEl.textContent = 'Choose file';
        }
    }

    /**
     * Validate the Identity Number input.
     * @returns {boolean}
     */
    function validateIdentityNumber() {
        const value = identityNumberInput.value.trim();
        const errorEl = document.getElementById('identityNumberError');

        if (!value) {
            identityNumberInput.classList.add('input-error');
            identityNumberInput.setAttribute('aria-invalid', 'true');
            if (errorEl) errorEl.textContent = 'Identity number is required.';
            return false;
        }
        if (!ID_NUMBER_PATTERN.test(value)) {
            identityNumberInput.classList.add('input-error');
            identityNumberInput.setAttribute('aria-invalid', 'true');
            if (errorEl) errorEl.textContent = 'Enter 6-20 letters or numbers.';
            return false;
        }
        identityNumberInput.classList.remove('input-error');
        identityNumberInput.removeAttribute('aria-invalid');
        if (errorEl) errorEl.textContent = '';
        return true;
    }

    /**
     * Submit the verification and register with the backend.
     */
    async function submitRegistration() {
        const raw = sessionStorage.getItem('handyhire.provider.profile');
        const profile = raw ? JSON.parse(raw) : {};
        const skillKey = (profile.skills || '').toLowerCase();
        const profession = SKILL_LABELS[skillKey] || skillKey || 'Professional';

        const payload = {
            full_name: (profile.fullName || '').trim(),
            email: (profile.email || '').trim(),
            mobile_number: (profile.mobileNumber || '').trim(),
            password: profile.password || '',
            profession: profession,
            bio: '',
            experience: profile.age ? profile.age + ' years' : '',
            qualification: profile.qualification || '',
            location: (profile.address || '').trim() || 'Not specified',
            price: parseInt(profile.price || '0', 10) || 0,
            availability: '',
            profile_image: null,
        };

        const api = window.HandyHireAPI;
        if (!api || !api.apiFetch) {
            throw new Error('Unable to connect to HandyHire server. Please make sure the backend is running.');
        }

        const response = await api.apiFetch('/api/auth/register/worker', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            let detail = 'Registration failed. Please try again.';
            try {
                const data = await response.json();
                if (data.detail) detail = data.detail;
            } catch (e) {}
            throw new Error(detail);
        }

        const tokenData = await response.json();
        window.HandyHireAPI.setAuth(tokenData.access_token, tokenData);

        const user = await window.HandyHireAPI.fetchCurrentUser();
        if (!user) {
            throw new Error('Registration succeeded but failed to load profile.');
        }

        return tokenData;
    }

    /**
     * Navigate back to step 2.
     */
    function navigateBack() {
        window.location.href = ROUTES.BACK;
    }

    /**
     * Persist the complete provider profile into sessionStorage
     * so the provider profile page can display the correct
     * logged-in provider information.
     */
    function persistFinalProfile() {
        try {
            const existing = sessionStorage.getItem('handyhire.provider.profile');
            const profile = existing ? JSON.parse(existing) : {};
            profile.identityNumber = identityNumberInput.value.trim();
            profile.registeredAt = new Date().toISOString();
            sessionStorage.setItem('handyhire.provider.profile', JSON.stringify(profile));
        } catch (e) {
            // Ignore storage errors.
        }
    }

    /**
     * Submit the verification and proceed to the dashboard.
     */
    async function navigateSubmit() {
        const errorEl = document.getElementById('providerRegisterFormError');
        try {
            if (errorEl) errorEl.textContent = '';
            await submitRegistration();
            persistFinalProfile();
            window.location.href = ROUTES.SUBMIT;
        } catch (err) {
            if (errorEl) errorEl.textContent = err.message || 'Registration failed. Please try again.';
        }
    }

    /**
     * Initialize the verification form.
     */
    function init() {
        if (!form) return;

        // File selection handlers - update label and re-validate if previously errored
        uploadPhotoInput.addEventListener('change', function () {
            updateFileLabel(uploadPhotoInput);
            const wrapper = uploadPhotoInput.closest('.file-wrapper');
            if (wrapper && wrapper.classList.contains('has-error')) validateFile(uploadPhotoInput, FILE_RULES.uploadPhoto);
        });

        photoIdentityInput.addEventListener('change', function () {
            updateFileLabel(photoIdentityInput);
            const wrapper = photoIdentityInput.closest('.file-wrapper');
            if (wrapper && wrapper.classList.contains('has-error')) validateFile(photoIdentityInput, FILE_RULES.photoIdentity);
        });

        additionalDocsInput.addEventListener('change', function () {
            updateFileLabel(additionalDocsInput);
            const wrapper = additionalDocsInput.closest('.file-wrapper');
            if (wrapper && wrapper.classList.contains('has-error')) validateFile(additionalDocsInput, FILE_RULES.additionalDocuments);
        });

        // Live validation - clear identity number error as the user types
        identityNumberInput.addEventListener('input', function () {
            if (identityNumberInput.classList.contains('input-error')) validateIdentityNumber();
        });

        // Back button - always navigates (no validation needed)
        if (backBtn) {
            backBtn.addEventListener('click', navigateBack);
        }

        // Form submission (Submit button)
        form.addEventListener('submit', async function (event) {
            event.preventDefault();

            const isPhotoValid = validateFile(uploadPhotoInput, FILE_RULES.uploadPhoto);
            const isIdentityValid = validateFile(photoIdentityInput, FILE_RULES.photoIdentity);
            const isNumberValid = validateIdentityNumber();
            const isAdditionalValid = validateFile(additionalDocsInput, FILE_RULES.additionalDocuments);

            if (isPhotoValid && isIdentityValid && isNumberValid && isAdditionalValid) {
                await navigateSubmit();
            } else {
                // Focus the first invalid control for accessibility
                const firstInvalidFile = form.querySelector('.file-wrapper.has-error .file-input');
                if (firstInvalidFile) {
                    firstInvalidFile.focus();
                } else {
                    const firstInvalidInput = form.querySelector('.input-error');
                    if (firstInvalidInput) firstInvalidInput.focus();
                }
            }
        });
    }

    // Run after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
