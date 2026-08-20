/* =========================================================
   HandyHire - Provider Registration Step 2 JavaScript
   Screen: SP R2 - Contact Details
   Handles validation, Back navigation, and step 3 navigation.
   ========================================================= */

(function () {
    'use strict';

    /**
     * Destination routes.
     */
    const ROUTES = {
        BACK: 'provider-register-step1.html',
        NEXT: 'provider-register-step3.html',
    };

    /**
     * Regex patterns used for input validation.
     */
    const PATTERNS = {
        // 10-digit Indian mobile number (starts 6-9)
        MOBILE: /^[6-9]\d{9}$/,
        // Standard email format
        EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
    };

    /**
     * Reference DOM elements.
     */
    const form = document.getElementById('providerRegisterStep2Form');
    const backBtn = document.getElementById('backBtn');
    const mobileInput = document.getElementById('mobileNumber');
    const emailInput = document.getElementById('email');
    const addressInput = document.getElementById('address');
    const passwordInput = document.getElementById('password');
    const priceInput = document.getElementById('price');

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
     * Validate the Email field.
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
     * Validate the Price field.
     * @returns {boolean}
     */
    function validatePrice() {
        const raw = priceInput.value.trim();
        if (!raw) {
            setFieldError(priceInput, 'Price is required.');
            return false;
        }
        const value = Number(raw);
        if (!Number.isInteger(value) || value <= 0) {
            setFieldError(priceInput, 'Enter a valid price greater than 0.');
            return false;
        }
        setFieldError(priceInput, '');
        return true;
    }

    /**
     * Restrict mobile input to digits only as the user types.
     */
    function sanitizeMobileInput() {
        mobileInput.value = mobileInput.value.replace(/\D/g, '').slice(0, 10);
    }

    /**
     * Navigate back to step 1.
     */
    function navigateBack() {
        window.location.href = ROUTES.BACK;
    }

    /**
     * Persist the current step's form data into sessionStorage
     * so later steps and the profile page can reconstruct the
     * full provider profile.
     */
    function persistFormData() {
        try {
            const existing = sessionStorage.getItem('handyhire.provider.profile');
            const profile = existing ? JSON.parse(existing) : {};
            profile.mobileNumber = mobileInput.value.trim();
            profile.email = emailInput.value.trim();
            profile.address = addressInput.value;
            profile.password = passwordInput.value;
            profile.price = priceInput.value.trim();
            sessionStorage.setItem('handyhire.provider.profile', JSON.stringify(profile));
        } catch (e) {
            // Ignore storage errors.
        }
    }

    /**
     * Navigate to step 3.
     */
    function navigateNext() {
        persistFormData();
        window.location.href = ROUTES.NEXT;
    }

    /**
     * Initialize the registration form.
     */
    function init() {
        if (!form) return;

        // Live input restrictions
        mobileInput.addEventListener('input', sanitizeMobileInput);

        // Live validation - clear errors as the user types/changes
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
        priceInput.addEventListener('input', function () {
            if (priceInput.classList.contains('input-error')) validatePrice();
        });

        // Back button - always navigates (no validation needed)
        if (backBtn) {
            backBtn.addEventListener('click', navigateBack);
        }

        // Form submission (Next button)
        form.addEventListener('submit', function (event) {
            event.preventDefault();

            const isMobileValid = validateMobile();
            const isEmailValid = validateEmail();
            const isAddressValid = validateAddress();
            const isPasswordValid = validatePassword();
            const isPriceValid = validatePrice();

            if (isMobileValid && isEmailValid && isAddressValid && isPasswordValid && isPriceValid) {
                navigateNext();
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
