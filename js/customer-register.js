/* =========================================================
   HandyHire - Customer Registration JavaScript
   Screen: SU R1 - Personal Details
   Handles validation and navigation to the home page.
   ========================================================= */

(function () {
    'use strict';

    /**
     * Destination routes for the HandyHire application.
     */
    const ROUTES = {
        NEXT: 'home.html',
    };

    /**
     * Regex patterns used for input validation.
     */
    const PATTERNS = {
        // 10-digit Indian mobile number (allows optional +91 / 0 prefix removal client-side)
        MOBILE: /^[6-9]\d{9}$/,
        // Standard email format
        EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
        // Letters, spaces, dot, hyphen, apostrophe (name characters)
        NAME: /^[A-Za-z][A-Za-z .'-]{1,49}$/,
    };

    /**
     * Reference DOM elements.
     */
    const form = document.getElementById('customerRegisterForm');
    const fullNameInput = document.getElementById('fullName');
    const mobileInput = document.getElementById('mobileNumber');
    const emailInput = document.getElementById('emailAddress');
    const addressInput = document.getElementById('address');
    const passwordInput = document.getElementById('password');

    /**
     * Display a validation message under a field and mark it as invalid.
     *
     * @param {HTMLInputElement|HTMLSelectElement} input - Field element.
     * @param {string} message - Message to display (empty to clear).
     */
    function setFieldError(input, message) {
        const errorId = input.getAttribute('aria-describedby');
        const errorEl = errorId ? document.getElementById(errorId) : null;

        if (message) {
            input.classList.add('input-error');
            input.setAttribute('aria-invalid', 'true');
            if (errorEl) errorEl.textContent = message;
        } else {
            input.classList.remove('input-error');
            input.removeAttribute('aria-invalid');
            if (errorEl) errorEl.textContent = '';
        }
    }

    /**
     * Validate the Full Name field.
     * @returns {boolean}
     */
    function validateFullName() {
        const value = fullNameInput.value.trim();
        if (!value) {
            setFieldError(fullNameInput, 'Full name is required.');
            return false;
        }
        if (!PATTERNS.NAME.test(value)) {
            setFieldError(fullNameInput, 'Please enter a valid name (letters only).');
            return false;
        }
        setFieldError(fullNameInput, '');
        return true;
    }

    /**
     * Validate the Mobile Number field.
     * @returns {boolean}
     */
    function validateMobile() {
        const value = mobileInput.value.trim();
        if (!value) {
            setFieldError(mobileInput, 'Mobile number is required.');
            return false;
        }
        if (!PATTERNS.MOBILE.test(value)) {
            setFieldError(mobileInput, 'Enter a valid 10-digit mobile number.');
            return false;
        }
        setFieldError(mobileInput, '');
        return true;
    }

    /**
     * Validate the Email Address field.
     * @returns {boolean}
     */
    function validateEmail() {
        const value = emailInput.value.trim();
        if (!value) {
            setFieldError(emailInput, 'Email address is required.');
            return false;
        }
        if (!PATTERNS.EMAIL.test(value)) {
            setFieldError(emailInput, 'Enter a valid email address.');
            return false;
        }
        setFieldError(emailInput, '');
        return true;
    }

    /**
     * Validate the Address dropdown.
     * @returns {boolean}
     */
    function validateAddress() {
        const value = addressInput.value;
        if (!value) {
            setFieldError(addressInput, 'Please select an address.');
            return false;
        }
        setFieldError(addressInput, '');
        return true;
    }

    /**
     * Validate the Password field.
     * @returns {boolean}
     */
    function validatePassword() {
        const value = passwordInput.value;
        if (!value) {
            setFieldError(passwordInput, 'Password is required.');
            return false;
        }
        if (value.length < 6) {
            setFieldError(passwordInput, 'Password must be at least 6 characters.');
            return false;
        }
        setFieldError(passwordInput, '');
        return true;
    }

    /**
     * Display a general error message on the form.
     * @param {string} message
     */
    function setFormError(message) {
        const errorEl = document.getElementById('customerRegisterFormError');
        if (errorEl) errorEl.textContent = message;
    }

    /**
     * Clear any existing form-level error.
     */
    function clearFormError() {
        const errorEl = document.getElementById('customerRegisterFormError');
        if (errorEl) errorEl.textContent = '';
    }

    /**
     * Restrict mobile input to digits only as the user types.
     */
    function sanitizeMobileInput() {
        mobileInput.value = mobileInput.value.replace(/\D/g, '').slice(0, 10);
    }

    /**
     * Persist the just-registered customer details so the
     * Profile page (and any other customer-side surface)
     * can show the customer's real name instead of a
     * placeholder. Wrapped in try/catch so private-mode
     * browsers don't break the navigation.
     */
    function persistCustomerProfile() {
        try {
            const profile = {
                fullName: (fullNameInput && fullNameInput.value
                    ? fullNameInput.value.trim()
                    : ''),
                mobile:   (mobileInput   && mobileInput.value
                    ? mobileInput.value.trim()
                    : ''),
                email:    (emailInput    && emailInput.value
                    ? emailInput.value.trim()
                    : ''),
                address:  (addressInput  && addressInput.value
                    ? addressInput.value
                    : ''),
            };
            localStorage.setItem('customerName',  profile.fullName);
            localStorage.setItem('customerProfile', JSON.stringify(profile));
        } catch (e) {
            // Ignore storage errors - navigation still works.
        }
    }

    /**
     * Display a general error message on the form.
     * @param {string} message
     */
    function setFormError(message) {
        const errorEl = document.getElementById('customerRegisterFormError');
        if (errorEl) errorEl.textContent = message;
    }

    /**
     * Clear any existing form-level error.
     */
    function clearFormError() {
        const errorEl = document.getElementById('customerRegisterFormError');
        if (errorEl) errorEl.textContent = '';
    }

    /**
     * Submit the registration to the backend.
     */
    async function submitRegistration() {
        const payload = {
            full_name: fullNameInput.value.trim(),
            email: emailInput.value.trim(),
            mobile_number: mobileInput.value.trim(),
            password: passwordInput.value,
            address: addressInput.value || null,
            city: null,
        };

        const api = window.HandyHireAPI;
        if (!api || !api.apiFetch) {
            throw new Error('Unable to connect to HandyHire server. Please make sure the backend is running.');
        }

        const response = await api.apiFetch('/api/auth/register/customer', {
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

        // The register response already contains the authenticated
        // identity (user_id, role, full_name), so no follow-up
        // /api/auth/me request is needed. The JWT remains the
        // sole authentication credential.
        const tokenData = await response.json();
        window.HandyHireAPI.setAuth(tokenData.access_token, {
            id: tokenData.user_id,
            full_name: tokenData.full_name,
            role: tokenData.role,
        });

        return tokenData;
    }

    /**
     * Navigate to the next page.
     */
    function navigateNext() {
        window.location.href = ROUTES.NEXT;
    }

    /**
     * Initialize the registration form.
     */
    function init() {
        if (!form) return;

        if (window.HandyHireAPI && window.HandyHireAPI.isLoggedIn()) {
            window.location.href = 'home.html';
            return;
        }

        // Live input restrictions
        mobileInput.addEventListener('input', sanitizeMobileInput);

        // Live validation - clear errors as the user types
        fullNameInput.addEventListener('input', function () {
            if (fullNameInput.classList.contains('input-error')) validateFullName();
        });
        mobileInput.addEventListener('input', function () {
            if (mobileInput.classList.contains('input-error')) validateMobile();
        });
        emailInput.addEventListener('input', function () {
            if (emailInput.classList.contains('input-error')) validateEmail();
        });
        addressInput.addEventListener('change', function () {
            if (addressInput.classList.contains('input-error')) validateAddress();
        });
        passwordInput.addEventListener('input', function () {
            if (passwordInput.classList.contains('input-error')) validatePassword();
        });

        // Form submission
        form.addEventListener('submit', async function (event) {
            event.preventDefault();
            clearFormError();

            const isNameValid = validateFullName();
            const isMobileValid = validateMobile();
            const isEmailValid = validateEmail();
            const isAddressValid = validateAddress();
            const isPasswordValid = validatePassword();

            if (isNameValid && isMobileValid && isEmailValid && isAddressValid && isPasswordValid) {
                var submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Creating account\u2026';
                }
                try {
                    await submitRegistration();
                    persistCustomerProfile();
                    navigateNext();
                } catch (err) {
                    setFormError(err.message || 'Registration failed. Please try again.');
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Next \u2192';
                    }
                }
            } else {
                const firstInvalid = form.querySelector('.input-error');
                if (firstInvalid) firstInvalid.focus();
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
