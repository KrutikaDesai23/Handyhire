(function () {
    'use strict';

    const BACK_PAGE = 'provider-register-step1.html';
    const NEXT_PAGE = 'provider-register-step3.html';
    const PROFILE_KEY = 'handyhire.provider.profile';
    const SERVER_ERROR_KEY = 'handyhire.provider.registrationError';

    const MOBILE_PATTERN = /^[6-9]\d{9}$/;
    const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    const form = document.getElementById('providerRegisterStep2Form');
    const backBtn = document.getElementById('backBtn');
    const nextBtn = form
        ? form.querySelector('button[type="submit"]')
        : null;

    const mobileInput = document.getElementById('mobileNumber');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const priceInput = document.getElementById('price');
    const addressInput = document.getElementById('address');

    function setFieldError(input, message) {
        const describedBy =
            input.getAttribute('aria-describedby') || '';

        const errorEl = describedBy
            .split(' ')
            .map((id) => document.getElementById(id))
            .find(
                (element) =>
                    element &&
                    element.classList.contains('form-error')
            );

        if (message) {
            input.classList.add('input-error');
            input.setAttribute('aria-invalid', 'true');

            if (errorEl) {
                errorEl.textContent = message;
            }
        } else {
            input.classList.remove('input-error');
            input.removeAttribute('aria-invalid');

            if (errorEl) {
                errorEl.textContent = '';
            }
        }
    }

    function validateMobile() {
        const value = mobileInput.value.trim();

        if (!value) {
            setFieldError(
                mobileInput,
                'Please enter your mobile number.'
            );
            return false;
        }

        if (!MOBILE_PATTERN.test(value)) {
            setFieldError(
                mobileInput,
                'Enter a 10-digit mobile number starting with 6, 7, 8 or 9.'
            );
            return false;
        }

        setFieldError(mobileInput, '');
        return true;
    }

    function validateEmail() {
        const value = emailInput.value.trim();

        if (!value) {
            setFieldError(
                emailInput,
                'Please enter your email address.'
            );
            return false;
        }

        if (!EMAIL_PATTERN.test(value)) {
            setFieldError(
                emailInput,
                'Enter a valid email address, for example name@gmail.com.'
            );
            return false;
        }

        setFieldError(emailInput, '');
        return true;
    }

    function validatePassword() {
        const value = passwordInput.value;

        if (!value) {
            setFieldError(
                passwordInput,
                'Please create a password.'
            );
            return false;
        }

        if (value.length < 6) {
            setFieldError(
                passwordInput,
                'Password must contain at least 6 characters.'
            );
            return false;
        }

        if (value.length > 128) {
            setFieldError(
                passwordInput,
                'Password cannot contain more than 128 characters.'
            );
            return false;
        }

        setFieldError(passwordInput, '');
        return true;
    }

    function validatePrice() {
        const raw = priceInput.value.trim();
        const price = Number(raw);

        if (!raw) {
            setFieldError(
                priceInput,
                'Please enter your service price.'
            );
            return false;
        }

        if (!Number.isInteger(price)) {
            setFieldError(
                priceInput,
                'Price must be a whole number.'
            );
            return false;
        }

        if (price <= 0) {
            setFieldError(
                priceInput,
                'Price must be greater than ₹0.'
            );
            return false;
        }

        setFieldError(priceInput, '');
        return true;
    }

    function validateAddress() {
        if (!addressInput.value) {
            setFieldError(
                addressInput,
                'Please select your address.'
            );
            return false;
        }

        setFieldError(addressInput, '');
        return true;
    }

    async function checkEmailAndMobileAvailability() {
        const api = window.HandyHireAPI;

        if (!api || typeof api.apiFetch !== 'function') {
            setFieldError(
                emailInput,
                'Unable to contact the server. Make sure the backend is running.'
            );
            return false;
        }

        const parameters = new URLSearchParams({
            email: emailInput.value.trim().toLowerCase(),
            mobile_number: mobileInput.value.trim()
        });

        try {
            const response = await api.apiFetch(
                `/api/auth/register/worker/availability?${parameters.toString()}`
            );

            if (!response.ok) {
                setFieldError(
                    emailInput,
                    'Unable to verify the email and mobile number. Please try again.'
                );
                return false;
            }

            const result = await response.json();
            let available = true;

            if (!result.mobile_available) {
                setFieldError(
                    mobileInput,
                    'This mobile number is already registered. Sign in or use another number.'
                );
                available = false;
            }

            if (!result.email_available) {
                setFieldError(
                    emailInput,
                    'This email is already registered. Sign in or use another email.'
                );
                available = false;
            }

            if (result.mobile_available) {
                setFieldError(mobileInput, '');
            }

            if (result.email_available) {
                setFieldError(emailInput, '');
            }

            return available;
        } catch (error) {
            setFieldError(
                emailInput,
                'Unable to contact the server. Make sure the backend is running.'
            );
            return false;
        }
    }

    function saveFormData() {
        try {
            const existing =
                sessionStorage.getItem(PROFILE_KEY);

            const profile = existing
                ? JSON.parse(existing)
                : {};

            profile.mobileNumber =
                mobileInput.value.trim();

            profile.email =
                emailInput.value.trim().toLowerCase();

            profile.password =
                passwordInput.value;

            profile.price =
                priceInput.value.trim();

            profile.address =
                addressInput.value;

            sessionStorage.setItem(
                PROFILE_KEY,
                JSON.stringify(profile)
            );
        } catch (error) {
            console.error(
                'Could not save Step 2 details.',
                error
            );
        }
    }

    function restoreFormData() {
        try {
            const raw =
                sessionStorage.getItem(PROFILE_KEY);

            if (!raw) return;

            const profile = JSON.parse(raw);

            mobileInput.value =
                profile.mobileNumber || '';

            emailInput.value =
                profile.email || '';

            passwordInput.value =
                profile.password || '';

            priceInput.value =
                profile.price || '';

            addressInput.value =
                profile.address || '';
        } catch (error) {
            console.error(
                'Could not restore Step 2 details.',
                error
            );
        }
    }

    function showBackendError() {
        const fieldMap = {
            mobile_number: mobileInput,
            email: emailInput,
            password: passwordInput,
            price: priceInput,
            location: addressInput
        };

        try {
            const raw =
                sessionStorage.getItem(SERVER_ERROR_KEY);

            if (!raw) return;

            const savedError = JSON.parse(raw);
            const input = fieldMap[savedError.field];

            if (!input) return;

            sessionStorage.removeItem(SERVER_ERROR_KEY);

            setFieldError(
                input,
                savedError.message ||
                    'Please check this field.'
            );

            input.focus();
        } catch (error) {
            sessionStorage.removeItem(SERVER_ERROR_KEY);
        }
    }

    function setCheckingState(checking) {
        if (!nextBtn) return;

        nextBtn.disabled = checking;
        nextBtn.textContent = checking
            ? 'Checking...'
            : 'Next →';
    }

    function init() {
        if (!form) return;

        restoreFormData();
        showBackendError();

        mobileInput.addEventListener('input', function () {
            mobileInput.value = mobileInput.value
                .replace(/\D/g, '')
                .slice(0, 10);

            if (
                mobileInput.classList.contains('input-error')
            ) {
                validateMobile();
            }
        });

        emailInput.addEventListener('input', function () {
            if (
                emailInput.classList.contains('input-error')
            ) {
                validateEmail();
            }
        });

        passwordInput.addEventListener('input', function () {
            if (
                passwordInput.classList.contains('input-error')
            ) {
                validatePassword();
            }
        });

        priceInput.addEventListener('input', function () {
            if (
                priceInput.classList.contains('input-error')
            ) {
                validatePrice();
            }
        });

        addressInput.addEventListener('change', function () {
            validateAddress();
        });

        if (backBtn) {
            backBtn.addEventListener('click', function () {
                saveFormData();
                window.location.href = BACK_PAGE;
            });
        }

        form.addEventListener('submit', async function (event) {
            event.preventDefault();

            const validMobile = validateMobile();
            const validEmail = validateEmail();
            const validPassword = validatePassword();
            const validPrice = validatePrice();
            const validAddress = validateAddress();

            if (
                !validMobile ||
                !validEmail ||
                !validPassword ||
                !validPrice ||
                !validAddress
            ) {
                const firstInvalid =
                    form.querySelector('.input-error');

                if (firstInvalid) {
                    firstInvalid.focus();
                }

                return;
            }

            setCheckingState(true);

            const detailsAvailable =
                await checkEmailAndMobileAvailability();

            setCheckingState(false);

            if (!detailsAvailable) {
                const firstInvalid =
                    form.querySelector('.input-error');

                if (firstInvalid) {
                    firstInvalid.focus();
                }

                return;
            }

            saveFormData();
            window.location.href = NEXT_PAGE;
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener(
            'DOMContentLoaded',
            init
        );
    } else {
        init();
    }
})();