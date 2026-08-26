/* =========================================================
   HandyHire - Provider Registration Step 2
   Contact Details + Booking Preference
   ========================================================= */

(function () {
    'use strict';

    const ROUTES = {
        BACK: 'provider-register-step1.html',
        NEXT: 'provider-register-step3.html',
    };

    const PROFILE_KEY = 'handyhire.provider.profile';
    const SERVER_ERROR_KEY =
        'handyhire.provider.registrationError';


    const PATTERNS = {
        MOBILE: /^[6-9]\d{9}$/,
        EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
    };


    /* =========================================================
       DOM ELEMENTS
       ========================================================= */

    const form =
        document.getElementById(
            'providerRegisterStep2Form'
        );

    const backBtn =
        document.getElementById('backBtn');

    const mobileInput =
        document.getElementById('mobileNumber');

    const emailInput =
        document.getElementById('email');

    const addressInput =
        document.getElementById('address');

    const passwordInput =
        document.getElementById('password');

    const priceInput =
        document.getElementById('price');

    const bookingPreferenceInput =
        document.getElementById(
            'bookingPreference'
        );


    /* =========================================================
       ERROR DISPLAY
       ========================================================= */

    function setFieldError(input, message) {

        if (!input) return;

        const errorId =
            input.getAttribute(
                'aria-describedby'
            );

        const errorEl =
            errorId
                ? document.getElementById(errorId)
                : null;


        if (message) {

            input.classList.add(
                'input-error'
            );

            input.setAttribute(
                'aria-invalid',
                'true'
            );

            if (errorEl) {
                errorEl.textContent = message;
            }

        } else {

            input.classList.remove(
                'input-error'
            );

            input.removeAttribute(
                'aria-invalid'
            );

            if (errorEl) {
                errorEl.textContent = '';
            }
        }
    }


    /* =========================================================
       MOBILE
       ========================================================= */

    function validateMobile() {

        const value =
            mobileInput.value.trim();


        if (!value) {

            setFieldError(
                mobileInput,
                'Mobile number is required.'
            );

            return false;
        }


        if (!PATTERNS.MOBILE.test(value)) {

            setFieldError(
                mobileInput,
                'Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9.'
            );

            return false;
        }


        setFieldError(
            mobileInput,
            ''
        );

        return true;
    }


    /* =========================================================
       EMAIL
       ========================================================= */

    function validateEmail() {

        const value =
            emailInput.value.trim();


        if (!value) {

            setFieldError(
                emailInput,
                'Email address is required.'
            );

            return false;
        }


        if (!PATTERNS.EMAIL.test(value)) {

            setFieldError(
                emailInput,
                'Enter a valid email address.'
            );

            return false;
        }


        setFieldError(
            emailInput,
            ''
        );

        return true;
    }


    /* =========================================================
       ADDRESS
       ========================================================= */

    function validateAddress() {

        const value =
            addressInput.value;


        if (!value) {

            setFieldError(
                addressInput,
                'Please select an address.'
            );

            return false;
        }


        setFieldError(
            addressInput,
            ''
        );

        return true;
    }


    /* =========================================================
       PASSWORD
       ========================================================= */

    function validatePassword() {

        const value =
            passwordInput.value;


        if (!value) {

            setFieldError(
                passwordInput,
                'Password is required.'
            );

            return false;
        }


        if (value.length < 6) {

            setFieldError(
                passwordInput,
                'Password must be at least 6 characters.'
            );

            return false;
        }


        setFieldError(
            passwordInput,
            ''
        );

        return true;
    }


    /* =========================================================
       PRICE
       ========================================================= */

    function validatePrice() {

        const raw =
            priceInput.value.trim();


        if (!raw) {

            setFieldError(
                priceInput,
                'Price is required.'
            );

            return false;
        }


        const value =
            Number(raw);


        if (
            !Number.isInteger(value) ||
            value <= 0
        ) {

            setFieldError(
                priceInput,
                'Enter a valid price greater than 0.'
            );

            return false;
        }


        setFieldError(
            priceInput,
            ''
        );

        return true;
    }


    /* =========================================================
       BOOKING PREFERENCE
       ========================================================= */

    function validateBookingPreference() {

        if (!bookingPreferenceInput) {
            return false;
        }


        const value =
            bookingPreferenceInput.value;


        const validValues = [
            'pre-booking',
            'on-spot',
            'both'
        ];


        if (!validValues.includes(value)) {

            setFieldError(
                bookingPreferenceInput,
                'Please select your booking preference.'
            );

            return false;
        }


        setFieldError(
            bookingPreferenceInput,
            ''
        );

        return true;
    }


    /* =========================================================
       MOBILE INPUT CLEANUP
       ========================================================= */

    function sanitizeMobileInput() {

        mobileInput.value =
            mobileInput.value
                .replace(/\D/g, '')
                .slice(0, 10);
    }


    /* =========================================================
       BACK
       ========================================================= */

    function navigateBack() {

        window.location.href =
            ROUTES.BACK;
    }


    /* =========================================================
       SAVE STEP 2 DATA
       ========================================================= */

    function persistFormData() {

        try {

            const existing =
                sessionStorage.getItem(
                    PROFILE_KEY
                );

            const profile =
                existing
                    ? JSON.parse(existing)
                    : {};


            profile.mobileNumber =
                mobileInput.value.trim();

            profile.email =
                emailInput.value.trim();

            profile.address =
                addressInput.value;

            profile.password =
                passwordInput.value;

            profile.price =
                priceInput.value.trim();

            /*
             * NEW:
             * Save booking preference
             */

            profile.bookingPreference =
                bookingPreferenceInput.value;


            sessionStorage.setItem(
                PROFILE_KEY,
                JSON.stringify(profile)
            );

        } catch (error) {

            console.error(
                'Unable to save registration data:',
                error
            );
        }
    }


    /* =========================================================
       RESTORE STEP 2
       ========================================================= */

    function restoreFormData() {

        try {

            const raw =
                sessionStorage.getItem(
                    PROFILE_KEY
                );

            if (!raw) return;


            const profile =
                JSON.parse(raw);


            mobileInput.value =
                profile.mobileNumber || '';

            emailInput.value =
                profile.email || '';

            addressInput.value =
                profile.address || '';

            passwordInput.value =
                profile.password || '';

            priceInput.value =
                profile.price || '';


            if (bookingPreferenceInput) {

                bookingPreferenceInput.value =
                    profile.bookingPreference || '';
            }


        } catch (error) {

            console.error(
                'Unable to restore registration data:',
                error
            );
        }
    }


    /* =========================================================
       BACKEND ERROR
       ========================================================= */

    function showSavedServerError() {

        const fieldMap = {

            mobile_number:
                mobileInput,

            email:
                emailInput,

            password:
                passwordInput,

            location:
                addressInput,

            price:
                priceInput,

            availability:
                bookingPreferenceInput
        };


        try {

            const raw =
                sessionStorage.getItem(
                    SERVER_ERROR_KEY
                );

            if (!raw) return;


            const serverError =
                JSON.parse(raw);


            const input =
                fieldMap[
                    serverError.field
                ];


            if (!input) return;


            sessionStorage.removeItem(
                SERVER_ERROR_KEY
            );


            setFieldError(
                input,
                serverError.message ||
                'Please check this field.'
            );


            input.focus();


        } catch (error) {

            sessionStorage.removeItem(
                SERVER_ERROR_KEY
            );
        }
    }


    /* =========================================================
       NEXT
       ========================================================= */

    function navigateNext() {

        persistFormData();

        window.location.href =
            ROUTES.NEXT;
    }


    /* =========================================================
       INITIALIZE
       ========================================================= */

    function init() {

        if (!form) return;


        restoreFormData();

        showSavedServerError();


        mobileInput.addEventListener(
            'input',
            sanitizeMobileInput
        );


        mobileInput.addEventListener(
            'input',
            function () {

                if (
                    mobileInput.classList.contains(
                        'input-error'
                    )
                ) {
                    validateMobile();
                }
            }
        );


        emailInput.addEventListener(
            'input',
            function () {

                if (
                    emailInput.classList.contains(
                        'input-error'
                    )
                ) {
                    validateEmail();
                }
            }
        );


        addressInput.addEventListener(
            'change',
            function () {

                if (
                    addressInput.classList.contains(
                        'input-error'
                    )
                ) {
                    validateAddress();
                }
            }
        );


        passwordInput.addEventListener(
            'input',
            function () {

                if (
                    passwordInput.classList.contains(
                        'input-error'
                    )
                ) {
                    validatePassword();
                }
            }
        );


        priceInput.addEventListener(
            'input',
            function () {

                if (
                    priceInput.classList.contains(
                        'input-error'
                    )
                ) {
                    validatePrice();
                }
            }
        );


        if (bookingPreferenceInput) {

            bookingPreferenceInput.addEventListener(
                'change',
                function () {

                    if (
                        bookingPreferenceInput
                            .classList
                            .contains(
                                'input-error'
                            )
                    ) {
                        validateBookingPreference();
                    }
                }
            );
        }


        if (backBtn) {

            backBtn.addEventListener(
                'click',
                navigateBack
            );
        }


        form.addEventListener(
            'submit',
            function (event) {

                event.preventDefault();


                const isMobileValid =
                    validateMobile();

                const isEmailValid =
                    validateEmail();

                const isAddressValid =
                    validateAddress();

                const isPasswordValid =
                    validatePassword();

                const isPriceValid =
                    validatePrice();

                const isBookingPreferenceValid =
                    validateBookingPreference();


                if (
                    isMobileValid &&
                    isEmailValid &&
                    isAddressValid &&
                    isPasswordValid &&
                    isPriceValid &&
                    isBookingPreferenceValid
                ) {

                    navigateNext();

                } else {

                    const firstInvalid =
                        form.querySelector(
                            '.input-error'
                        );

                    if (firstInvalid) {
                        firstInvalid.focus();
                    }
                }
            }
        );
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